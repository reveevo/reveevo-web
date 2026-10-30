import React from 'react';
import classNames from 'classnames';

import { FormattedMessage } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import { getDeliveryAddressFormValues } from '../../../util/deliveryAddress';

import { DeliveryAddressForm, H4, InlineTextButton } from '../../../components';

import css from './DeliveryAddressStep.module.css';

/**
 * Checkout step 1 for shipped orders: the delivery address.
 * The address is saved to the customer's profile (the same address as on the account page),
 * and the shipping fee is calculated from it.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {Object} [props.deliveryAddress] - Saved delivery address
 * @param {Object} props.currentUser - The current user (for the phone number from contact details)
 * @param {boolean} props.isEditing - Whether the form is shown
 * @param {Function} props.onEdit - Shows the form for editing the saved address
 * @param {Function} props.onSubmit - Saves the address (called with the form values)
 * @param {boolean} [props.inProgress] - Whether the address is being saved
 * @param {propTypes.error} [props.saveError] - Error from saving the address
 * @returns {JSX.Element}
 */
const DeliveryAddressStep = props => {
  const {
    className,
    deliveryAddress,
    currentUser,
    isEditing,
    onEdit,
    onSubmit,
    inProgress,
    saveError,
  } = props;

  return (
    <section className={classNames(css.root, className)}>
      <H4 as="h2" className={css.heading}>
        <FormattedMessage id="CheckoutPage.DeliveryAddressStep.heading" />
      </H4>
      {isEditing ? (
        <>
          <p className={css.description}>
            <FormattedMessage id="CheckoutPage.DeliveryAddressStep.description" />
          </p>
          <DeliveryAddressForm
            formId="CheckoutPageDeliveryAddressForm"
            initialValues={getDeliveryAddressFormValues(deliveryAddress, currentUser)}
            onSubmit={onSubmit}
            inProgress={inProgress}
            saveError={saveError}
            submitButtonText={<FormattedMessage id="CheckoutPage.DeliveryAddressStep.submit" />}
          />
        </>
      ) : (
        <div className={css.savedAddress}>
          <p className={css.address}>
            {deliveryAddress.address}
            <br />
            {deliveryAddress.neighborhood}
            <br />
            {deliveryAddress.phoneNumber}
            {deliveryAddress.details ? (
              <>
                <br />
                {deliveryAddress.details}
              </>
            ) : null}
          </p>
          <InlineTextButton type="button" className={css.editButton} onClick={onEdit}>
            <FormattedMessage id="CheckoutPage.DeliveryAddressStep.edit" />
          </InlineTextButton>
        </div>
      )}
    </section>
  );
};

export default DeliveryAddressStep;
