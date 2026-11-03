import React, { useEffect } from 'react';
import { Form as FinalForm } from 'react-final-form';
import classNames from 'classnames';

// Import configs and util modules
import { FormattedMessage, useIntl } from '../../../../util/reactIntl';
import { propTypes } from '../../../../util/types';
import { displayDeliveryPickup, displayDeliveryShipping } from '../../../../util/configHelpers';
import { isCompleteDeliveryAddress } from '../../../../util/deliveryAddress';

// Import shared components
import { Form, Button, FieldCheckbox, H5, InlineTextButton } from '../../../../components';

// Import modules from this directory
import css from './EditListingDeliveryForm.module.css';

/**
 * The EditListingDeliveryForm component.
 *
 * @component
 * @param {Object} props - The component props
 * @param {string} props.formId - The form ID
 * @param {string} [props.className] - Custom class that extends the default class for the root element
 * @param {Function} props.onSubmit - The submit function
 * @param {string} props.saveActionMsg - The save action message
 * @param {string} props.marketplaceCurrency - The marketplace currency
 * @param {boolean} props.hasStockInUse - Whether the stock is in use
 * @param {boolean} props.disabled - Whether the form is disabled
 * @param {boolean} props.ready - Whether the form is ready
 * @param {boolean} props.updated - Whether the form is updated
 * @param {boolean} props.updateInProgress - Whether the form is in progress
 * @param {Object} props.fetchErrors - The fetch errors
 * @param {propTypes.error} [props.fetchErrors.showListingsError] - The show listings error
 * @param {propTypes.error} [props.fetchErrors.updateListingError] - The update listing error
 * @param {Object} [props.deliveryAddress] - Seller's saved delivery address (shipping starts from it)
 * @param {Function} props.onOpenDeliveryAddressModal - Opens the modal for adding/editing the address
 * @returns {JSX.Element} The EditListingDeliveryForm component
 */
export const EditListingDeliveryForm = props => (
  <FinalForm
    {...props}
    render={formRenderProps => {
      const {
        formId = 'EditListingDeliveryForm',
        form,
        className,
        disabled,
        ready,
        handleSubmit,
        pristine,
        invalid,
        listingTypeConfig,
        saveActionMsg,
        deliveryAddress,
        onOpenDeliveryAddressModal,
        updated,
        updateInProgress,
        fetchErrors,
        values,
      } = formRenderProps;
      const intl = useIntl();

      // This is a bug fix for Final Form.
      // Without this, React will return a warning:
      //   "Cannot update a component (`ForwardRef(Field)`)
      //   while rendering a different component (`ForwardRef(Field)`)"
      // This seems to happen because validation calls listeneres and
      // that causes state to change inside final-form.
      // https://github.com/final-form/react-final-form/issues/751
      //
      // TODO: it might not be worth the trouble to show these fields as disabled,
      // if this fix causes trouble in future dependency updates.
      const { pauseValidation, resumeValidation } = form;
      pauseValidation(false);
      useEffect(() => resumeValidation(), [values]);

      const displayShipping = displayDeliveryShipping(listingTypeConfig);
      const displayPickup = displayDeliveryPickup(listingTypeConfig);
      const displayMultipleDelivery = displayShipping && displayPickup;
      const shippingEnabled = displayShipping && values.deliveryOptions?.includes('shipping');
      const pickupEnabled = displayPickup && values.deliveryOptions?.includes('pickup');

      const { updateListingError, showListingsError } = fetchErrors || {};

      const classes = classNames(css.root, className);
      const submitReady = (updated && pristine) || ready;
      const submitInProgress = updateInProgress;
      // The seller's address (one address, saved to their profile) is used for both options:
      // direct pick up by the buyer and shipping organized by Reveevo.
      const hasDeliveryAddress = isCompleteDeliveryAddress(deliveryAddress);
      const hasDeliveryOption = shippingEnabled || pickupEnabled;
      const submitDisabled =
        invalid || disabled || submitInProgress || !hasDeliveryOption || !hasDeliveryAddress;

      const shippingLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.shippingLabel' });
      const pickupLabel = intl.formatMessage({ id: 'EditListingDeliveryForm.pickupLabel' });

      const shippingClasses = classNames({
        [css.deliveryOption]: displayMultipleDelivery,
        [css.disabled]: !shippingEnabled,
        [css.hidden]: !displayShipping,
      });
      const openDeliveryAddressModal = e => {
        e.preventDefault();
        onOpenDeliveryAddressModal();
      };

      return (
        <Form className={classes} onSubmit={handleSubmit}>
          {updateListingError ? (
            <p className={css.error}>
              <FormattedMessage id="EditListingDeliveryForm.updateFailed" />
            </p>
          ) : null}

          {showListingsError ? (
            <p className={css.error}>
              <FormattedMessage id="EditListingDeliveryForm.showListingFailed" />
            </p>
          ) : null}

          <FieldCheckbox
            id={formId ? `${formId}.pickup` : 'pickup'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={pickupLabel}
            value="pickup"
          />

          <FieldCheckbox
            id={formId ? `${formId}.shipping` : 'shipping'}
            className={classNames(css.deliveryCheckbox, { [css.hidden]: !displayMultipleDelivery })}
            name="deliveryOptions"
            label={shippingLabel}
            value="shipping"
          />
          <div className={shippingClasses}>
            <p className={css.shippingInfo}>
              <FormattedMessage id="EditListingDeliveryForm.shippingInfo" />
            </p>
          </div>

          <div className={css.addressSection}>
            <H5 as="h2" className={css.addressHeading}>
              <FormattedMessage id="EditListingDeliveryForm.yourAddressHeading" />
            </H5>
            {hasDeliveryAddress ? (
              <p className={css.shippingAddress}>
                <FormattedMessage
                  id="EditListingDeliveryForm.shippingFrom"
                  values={{
                    address: deliveryAddress.address,
                    neighborhood: deliveryAddress.neighborhood,
                  }}
                />{' '}
                <InlineTextButton type="button" onClick={openDeliveryAddressModal}>
                  <FormattedMessage id="EditListingDeliveryForm.editAddress" />
                </InlineTextButton>
              </p>
            ) : (
              <p className={css.shippingAddressMissing}>
                <FormattedMessage id="EditListingDeliveryForm.addressMissing" />{' '}
                <InlineTextButton
                  type="button"
                  onClick={openDeliveryAddressModal}
                  disabled={!hasDeliveryOption}
                >
                  <FormattedMessage id="EditListingDeliveryForm.addAddress" />
                </InlineTextButton>
              </p>
            )}
          </div>

          <Button
            className={css.submitButton}
            type="submit"
            inProgress={submitInProgress}
            disabled={submitDisabled}
            ready={submitReady}
          >
            {saveActionMsg}
          </Button>
        </Form>
      );
    }}
  />
);

export default EditListingDeliveryForm;
