import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import appSettings from '../../config/settings';
import { useConfiguration } from '../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../util/reactIntl';
import { propTypes } from '../../util/types';
import { types as sdkTypes } from '../../util/sdkLoader';
import { formatMoney } from '../../util/currency';
import { composeValidators, moneySubUnitAmountAtLeast, required } from '../../util/validators';

import {
  FieldCurrencyInput,
  FieldSelect,
  FieldTextInput,
  Form,
  Heading,
  Modal,
  PrimaryButton,
} from '../../components';

import css from './MakeOfferModal.module.css';

const { Money } = sdkTypes;

// Browsers can't render huge number of select options (same limit as in ProductOrderForm)
const MAX_QUANTITY_FOR_DROPDOWN = 100;

// The offer must be lower than the listed price - otherwise the customer can just buy the item.
const lessThanListedPrice = (message, listedPrice) => value =>
  value?.amount && value.amount >= listedPrice.amount ? message : undefined;

const MakeOfferForm = props => (
  <FinalForm
    {...props}
    render={formRenderProps => {
      const {
        handleSubmit,
        invalid,
        price,
        maxQuantity,
        hasMultipleDeliveryMethods,
        minimumOfferSubUnits,
        values,
        intl,
      } = formRenderProps;

      const currencyConfig = appSettings.getCurrencyFormatting(price.currency);
      const quantityOptions = [
        ...Array(Math.min(maxQuantity || 1, MAX_QUANTITY_FOR_DROPDOWN)).keys(),
      ].map(i => `${i + 1}`);
      const listedPrice = formatMoney(intl, price);
      // Offers follow the same minimum as listing prices (minimum transaction size in Console).
      const minimumOffer = formatMoney(intl, new Money(minimumOfferSubUnits, price.currency));
      const offerValidators = composeValidators(
        required(intl.formatMessage({ id: 'MakeOfferModal.offerRequired' })),
        moneySubUnitAmountAtLeast(intl.formatMessage({ id: 'MakeOfferModal.offerRequired' }), 1),
        moneySubUnitAmountAtLeast(
          intl.formatMessage({ id: 'MakeOfferModal.offerTooLow' }, { minimumOffer }),
          minimumOfferSubUnits
        ),
        lessThanListedPrice(
          intl.formatMessage({ id: 'MakeOfferModal.offerTooHigh' }, { listedPrice }),
          price
        )
      );

      return (
        <Form onSubmit={handleSubmit}>
          <p className={css.listedPrice}>
            <FormattedMessage
              id="MakeOfferModal.listedPrice"
              values={{ price: listedPrice, quantity: values.quantity }}
            />
          </p>
          {maxQuantity > 1 ? (
            <FieldSelect
              id="MakeOfferModal.quantity"
              name="quantity"
              className={css.field}
              label={intl.formatMessage({ id: 'MakeOfferModal.quantityLabel' })}
            >
              {quantityOptions.map(q => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </FieldSelect>
          ) : null}
          {hasMultipleDeliveryMethods ? (
            <FieldSelect
              id="MakeOfferModal.deliveryMethod"
              name="deliveryMethod"
              className={css.field}
              label={intl.formatMessage({ id: 'MakeOfferModal.deliveryMethodLabel' })}
              validate={required(
                intl.formatMessage({ id: 'MakeOfferModal.deliveryMethodRequired' })
              )}
            >
              <option disabled value="">
                {intl.formatMessage({ id: 'ProductOrderForm.selectDeliveryMethodOption' })}
              </option>
              <option value="pickup">
                {intl.formatMessage({ id: 'ProductOrderForm.pickupOption' })}
              </option>
              <option value="shipping">
                {intl.formatMessage({ id: 'ProductOrderForm.shippingOption' })}
              </option>
            </FieldSelect>
          ) : null}
          <FieldCurrencyInput
            id="MakeOfferModal.offer"
            name="offer"
            className={css.field}
            label={intl.formatMessage({ id: 'MakeOfferModal.offerLabel' })}
            placeholder={intl.formatMessage({ id: 'MakeOfferModal.offerPlaceholder' })}
            currencyConfig={currencyConfig}
            validate={offerValidators}
          />
          <FieldTextInput
            id="MakeOfferModal.message"
            name="message"
            type="textarea"
            className={css.field}
            label={intl.formatMessage({ id: 'MakeOfferModal.messageLabel' })}
            placeholder={intl.formatMessage({ id: 'MakeOfferModal.messagePlaceholder' })}
          />
          <PrimaryButton className={css.submitButton} type="submit" disabled={invalid}>
            <FormattedMessage id="MakeOfferModal.submit" />
          </PrimaryButton>
        </Form>
      );
    }}
  />
);

/**
 * Modal where a customer makes an offer (a price per item) on a product listing.
 * The offer continues on CheckoutPage, where the customer's card is held for the offered price
 * (the provider accepts the offer = the order is confirmed).
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - The modal id
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Called when the modal is closed
 * @param {Function} props.onManageDisableScrolling - Passed through to Modal
 * @param {propTypes.money} props.price - The listed price of a single item
 * @param {number} [props.quantity] - The initial number of items the offer is for
 * @param {number} [props.maxQuantity] - The most items the offer can be for (shows a quantity picker if > 1)
 * @param {boolean} [props.pickupEnabled] - Whether the listing has direct pick up
 * @param {boolean} [props.shippingEnabled] - Whether the listing has shipping (organized by Reveevo)
 * @param {string} [props.deliveryMethod] - The initial delivery method
 * @param {Function} props.onSubmit - Called with { offer, quantity, deliveryMethod, message }
 * @returns {JSX.Element}
 */
const MakeOfferModal = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const {
    id,
    isOpen,
    onClose,
    onManageDisableScrolling,
    price,
    quantity,
    maxQuantity,
    pickupEnabled,
    shippingEnabled,
    deliveryMethod,
    onSubmit,
  } = props;
  const hasMultipleDeliveryMethods = !!pickupEnabled && !!shippingEnabled;
  const singleDeliveryMethod = shippingEnabled ? 'shipping' : pickupEnabled ? 'pickup' : null;
  const initialDeliveryMethod = hasMultipleDeliveryMethods ? deliveryMethod : singleDeliveryMethod;

  const handleSubmit = values => {
    const {
      offer,
      message,
      quantity: quantityRaw,
      deliveryMethod: selectedDeliveryMethod,
    } = values;
    onSubmit({
      offer,
      message: message?.trim(),
      quantity: Number.parseInt(quantityRaw, 10) || 1,
      deliveryMethod: selectedDeliveryMethod || singleDeliveryMethod,
    });
  };

  return (
    <Modal
      id={id}
      contentClassName={css.modalContent}
      isOpen={isOpen}
      onClose={onClose}
      onManageDisableScrolling={onManageDisableScrolling}
      usePortal
    >
      <Heading as="h2" rootClassName={css.heading}>
        <FormattedMessage id="MakeOfferModal.heading" />
      </Heading>
      <p className={css.description}>
        <FormattedMessage id="MakeOfferModal.description" />
      </p>
      {isOpen && price ? (
        <MakeOfferForm
          price={price}
          maxQuantity={maxQuantity}
          hasMultipleDeliveryMethods={hasMultipleDeliveryMethods}
          initialValues={{
            quantity: `${quantity || 1}`,
            ...(initialDeliveryMethod ? { deliveryMethod: initialDeliveryMethod } : {}),
          }}
          minimumOfferSubUnits={config.listingMinimumPriceSubUnits || 0}
          intl={intl}
          onSubmit={handleSubmit}
        />
      ) : null}
    </Modal>
  );
};

export default MakeOfferModal;
