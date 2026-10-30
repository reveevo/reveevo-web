import React from 'react';
import classNames from 'classnames';

import getCountryCodes from '../../../translations/countryCodes';
import { FormattedMessage } from '../../../util/reactIntl';
import { Heading } from '../../../components';

import AddressLinkMaybe from './AddressLinkMaybe';

import css from './TransactionPanel.module.css';

// Delivery address saved to transaction's protectedData.delivery (see server/services/shipping)
const DeliveryAddress = ({ labelId, deliveryAddress }) => {
  const { address, neighborhood, details, name, phoneNumber } = deliveryAddress || {};
  return address ? (
    <p className={css.shippingInfoContent}>
      <strong>
        <FormattedMessage id={labelId} />
      </strong>
      <br />
      {name ? (
        <>
          {name}
          <br />
        </>
      ) : null}
      {address}
      <br />
      {neighborhood}
      {details ? (
        <>
          <br />
          {details}
        </>
      ) : null}
      {phoneNumber ? (
        <>
          <br />
          {phoneNumber}
        </>
      ) : null}
    </p>
  ) : null;
};

// Functional component as a helper to build ActivityFeed section
const DeliveryInfoMaybe = props => {
  const { className, rootClassName, protectedData, listing, locale, transactionRole } = props;
  const classes = classNames(rootClassName || css.deliveryInfoContainer, className);
  const deliveryMethod = protectedData?.deliveryMethod;
  const isShipping = deliveryMethod === 'shipping';
  const isPickup = deliveryMethod === 'pickup';

  if (isPickup) {
    const pickupLocation = listing?.attributes?.publicData?.location || {};
    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.pickupInfoHeading" />
        </Heading>
        <div className={css.pickupInfoContent}>
          <AddressLinkMaybe
            linkRootClassName={css.pickupAddress}
            location={pickupLocation}
            geolocation={listing?.attributes?.geolocation}
            showAddress={true}
          />
        </div>
      </div>
    );
  } else if (isShipping && protectedData?.delivery) {
    // Reveevo arranges the delivery: each party sees only their own address as a confirmation
    // (seller: where the item is picked up, buyer: where it is delivered).
    // Both addresses are kept in protectedData.delivery for the marketplace team.
    const { from, to } = protectedData.delivery;
    const isProvider = transactionRole === 'provider';
    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.shippingInfoHeading" />
        </Heading>
        {isProvider ? (
          <DeliveryAddress labelId="TransactionPanel.deliveryFromLabel" deliveryAddress={from} />
        ) : (
          <DeliveryAddress labelId="TransactionPanel.deliveryToLabel" deliveryAddress={to} />
        )}
      </div>
    );
  } else if (isShipping) {
    const { name, phoneNumber, address } = protectedData?.shippingDetails || {};
    const { line1, line2, city, postalCode, state, country: countryCode } = address || {};
    const phoneMaybe = !!phoneNumber ? (
      <>
        {phoneNumber}
        <br />
      </>
    ) : null;

    const countryCodes = getCountryCodes(locale);
    const countryInfo = countryCodes.find(c => c.code === countryCode);
    const country = countryInfo?.name;

    return (
      <div className={classes}>
        <Heading as="h3" rootClassName={css.sectionHeading}>
          <FormattedMessage id="TransactionPanel.shippingInfoHeading" />
        </Heading>
        <div className={css.shippingInfoContent}>
          {name}
          <br />
          {phoneMaybe}
          {line1}
          {line2 ? `, ${line2}` : ''}
          <br />
          {postalCode}, {city}
          <br />
          {state ? `${state}, ` : ''}
          {country}
          <br />
        </div>
      </div>
    );
  }
  return null;
};

export default DeliveryInfoMaybe;
