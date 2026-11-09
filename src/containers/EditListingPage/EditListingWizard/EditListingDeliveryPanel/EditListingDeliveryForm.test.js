import React from 'react';
import '@testing-library/jest-dom';

import { fakeIntl } from '../../../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../../../util/testHelpers';

import EditListingDeliveryForm from './EditListingDeliveryForm';

const { screen, userEvent } = testingLibrary;

const noop = () => null;

const deliveryAddress = {
  address: 'Calle Colima 123, Roma Norte, Ciudad de México',
  origin: { lat: 19.42, lng: -99.16 },
  neighborhood: 'Roma Norte',
  details: '',
  countryCode: 'MX',
  regionCode: 'MX-MEX',
  phoneNumber: '+52 55 1234 5678',
};

const renderForm = props =>
  render(
    <EditListingDeliveryForm
      intl={fakeIntl}
      dispatch={noop}
      onSubmit={noop}
      saveActionMsg="Save location"
      updated={false}
      updateInProgress={false}
      disabled={false}
      ready={false}
      onOpenDeliveryAddressModal={noop}
      {...props}
    />
  );

describe('EditListingDeliveryForm', () => {
  it('Delivery options need the seller address before the form can be saved', async () => {
    const user = userEvent.setup();
    renderForm();

    // One address section for both pick up and shipping
    expect(screen.getByText('EditListingDeliveryForm.yourAddressHeading')).toBeInTheDocument();
    expect(screen.getByText('EditListingDeliveryForm.addressMissing')).toBeInTheDocument();

    // Test that save button is disabled at first
    expect(screen.getByRole('button', { name: 'Save location' })).toBeDisabled();

    // Pick up without an address: the seller still needs to add the address
    await user.click(screen.getByLabelText(/EditListingDeliveryForm.pickupLabel/i));
    expect(screen.getByRole('button', { name: 'Save location' })).toBeDisabled();
  });

  it('Shipping with the seller address can be saved', async () => {
    const user = userEvent.setup();
    renderForm({ deliveryAddress });

    await user.click(screen.getByLabelText(/EditListingDeliveryForm.shippingLabel/i));
    expect(screen.getByText('EditListingDeliveryForm.shippingFrom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save location' })).toBeEnabled();
  });
});
