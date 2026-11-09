import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import appSettings from '../../../config/settings';
import { useConfiguration } from '../../../context/configurationContext';
import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { propTypes } from '../../../util/types';
import { types as sdkTypes } from '../../../util/sdkLoader';
import { formatMoney } from '../../../util/currency';
import { composeValidators, moneySubUnitAmountAtLeast, required } from '../../../util/validators';
import { isTooManyRequestsError } from '../../../util/errors';

import {
  FieldCurrencyInput,
  FieldSelect,
  FieldTextInput,
  Form,
  Heading,
  Modal,
  PrimaryButton,
} from '../../../components';

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
        minimumOfferSubUnits,
        values,
        inProgress,
        makeOfferError,
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

      const errorMessage = isTooManyRequestsError(makeOfferError) ? (
        <FormattedMessage id="MakeOfferModal.tooManyRequestsError" />
      ) : makeOfferError ? (
        <FormattedMessage id="MakeOfferModal.submitFailed" />
      ) : null;

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
          {errorMessage ? <p className={css.error}>{errorMessage}</p> : null}
          <PrimaryButton
            className={css.submitButton}
            type="submit"
            inProgress={inProgress}
            disabled={invalid || inProgress}
          >
            <FormattedMessage id="MakeOfferModal.submit" />
          </PrimaryButton>
        </Form>
      );
    }}
  />
);

/**
 * Modal where a customer makes an offer (a price per item) on a product listing.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - The modal id
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Called when the modal is closed
 * @param {Function} props.onManageDisableScrolling - Passed through to Modal
 * @param {propTypes.money} props.price - The listed price of a single item
 * @param {number} props.quantity - The initial number of items the offer is for
 * @param {number} [props.maxQuantity] - The most items the offer can be for (shows a quantity picker if > 1)
 * @param {Function} props.onSubmit - Called with { offer, quantity, message }
 * @param {boolean} [props.inProgress] - Whether the offer is being submitted
 * @param {propTypes.error} [props.makeOfferError] - Error from the submission
 * @returns {JSX.Element}
 */
const MakeOfferModal = props => {
  const intl = useIntl();
  const config = useConfiguration();
  const { id, isOpen, onClose, onManageDisableScrolling, price, quantity, ...formProps } = props;

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
          initialValues={{ quantity: `${quantity || 1}` }}
          minimumOfferSubUnits={config.listingMinimumPriceSubUnits || 0}
          intl={intl}
          {...formProps}
        />
      ) : null}
    </Modal>
  );
};

export default MakeOfferModal;
