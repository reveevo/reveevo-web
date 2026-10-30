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
  it('Shipping needs the seller address before the form can be saved', async () => {
    const user = userEvent.setup();
    renderForm();

    // Pickup fields
    expect(screen.getByText('EditListingDeliveryForm.address')).toBeInTheDocument();
    expect(screen.getByText('EditListingDeliveryForm.building')).toBeInTheDocument();

    // Test that save button is disabled at first
    expect(screen.getByRole('button', { name: 'Save location' })).toBeDisabled();

    // Shipping without an address: seller is asked to add the address
    await user.click(screen.getByLabelText(/EditListingDeliveryForm.shippingLabel/i));
    expect(screen.getByText('EditListingDeliveryForm.shippingAddressMissing')).toBeInTheDocument();
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
