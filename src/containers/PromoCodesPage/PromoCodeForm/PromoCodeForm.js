import React from 'react';
import { Form as FinalForm } from 'react-final-form';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';
import { composeValidators, required } from '../../../util/validators';

import { FieldSelect, FieldTextInput, Form, PrimaryButton } from '../../../components';

import css from './PromoCodeForm.module.css';

const DISCOUNT_PERCENTAGE = 'percentage';
const DISCOUNT_FIXED = 'fixed';

const CODE_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

const wholeNumberBetween = (message, min, max) => value => {
  const number = Number(value);
  return value && (!Number.isInteger(number) || number < min || number > max) ? message : undefined;
};
const positiveAmount = message => value => (value && !(Number(value) > 0) ? message : undefined);
const codeFormat = message => value =>
  value && !CODE_PATTERN.test(value.trim()) ? message : undefined;

/**
 * The form values as the app's server expects them: amounts in minor units, the expiry at the
 * end of the chosen day.
 *
 * @param {Object} values
 * @returns {Object}
 */
export const getPromoCodeParams = values => {
  const { code, discountType, percentage, amount, maxUses, expiresAt } = values;
  const isPercentage = discountType === DISCOUNT_PERCENTAGE;
  return {
    code: code.trim().toUpperCase(),
    discountType,
    ...(isPercentage
      ? { percentage: Number(percentage) }
      : { amount: Math.round(Number(amount) * 100) }),
    maxUses: maxUses ? Number(maxUses) : null,
    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    active: true,
  };
};

/**
 * Form where an admin creates a promo code.
 *
 * @component
 * @param {Object} props
 * @param {number} props.maxPercentage The total commission percentage (the highest discount)
 * @param {string} props.currency The marketplace currency (fixed discounts)
 * @param {Function} props.onSubmit Called with the server params (see getPromoCodeParams)
 * @param {boolean} [props.inProgress]
 * @param {React.ReactNode} [props.errorMessage]
 * @returns {JSX.Element}
 */
const PromoCodeForm = props => {
  const intl = useIntl();
  const { maxPercentage, currency, onSubmit, inProgress, errorMessage } = props;
  const maxPercent = Math.max(1, Math.floor(maxPercentage || 1));
  const message = id => intl.formatMessage({ id }, { maxPercentage: maxPercent, currency });

  return (
    <FinalForm
      initialValues={{ discountType: DISCOUNT_PERCENTAGE }}
      onSubmit={(values, form) =>
        // restart() clears the values and the fields' touched state, so no errors show
        onSubmit(getPromoCodeParams(values)).then(() => setTimeout(() => form.restart()))
      }
      render={formRenderProps => {
        const { handleSubmit, invalid, values } = formRenderProps;
        const isPercentage = values.discountType === DISCOUNT_PERCENTAGE;

        return (
          <Form className={css.root} onSubmit={handleSubmit}>
            <div className={css.row}>
              <FieldTextInput
                id="PromoCodeForm.code"
                name="code"
                className={css.field}
                type="text"
                maxLength={20}
                label={message('PromoCodeForm.codeLabel')}
                placeholder={message('PromoCodeForm.codePlaceholder')}
                validate={composeValidators(
                  required(message('PromoCodeForm.codeRequired')),
                  codeFormat(message('PromoCodeForm.codeInvalid'))
                )}
              />
              <FieldSelect
                id="PromoCodeForm.discountType"
                name="discountType"
                className={css.field}
                label={message('PromoCodeForm.discountTypeLabel')}
              >
                <option value={DISCOUNT_PERCENTAGE}>
                  {message('PromoCodeForm.discountTypePercentage')}
                </option>
                <option value={DISCOUNT_FIXED}>{message('PromoCodeForm.discountTypeFixed')}</option>
              </FieldSelect>
            </div>
            <div className={css.row}>
              {isPercentage ? (
                <FieldTextInput
                  key="percentage"
                  id="PromoCodeForm.percentage"
                  name="percentage"
                  className={css.field}
                  type="number"
                  min={1}
                  max={maxPercent}
                  step={1}
                  label={message('PromoCodeForm.percentageLabel')}
                  validate={composeValidators(
                    required(message('PromoCodeForm.percentageRequired')),
                    wholeNumberBetween(message('PromoCodeForm.percentageInvalid'), 1, maxPercent)
                  )}
                />
              ) : (
                <FieldTextInput
                  key="amount"
                  id="PromoCodeForm.amount"
                  name="amount"
                  className={css.field}
                  type="number"
                  min={1}
                  step="0.01"
                  label={message('PromoCodeForm.amountLabel')}
                  validate={composeValidators(
                    required(message('PromoCodeForm.amountRequired')),
                    positiveAmount(message('PromoCodeForm.amountInvalid'))
                  )}
                />
              )}
              <FieldTextInput
                id="PromoCodeForm.maxUses"
                name="maxUses"
                className={css.field}
                type="number"
                min={1}
                step={1}
                label={message('PromoCodeForm.maxUsesLabel')}
                placeholder={message('PromoCodeForm.maxUsesPlaceholder')}
                validate={wholeNumberBetween(
                  message('PromoCodeForm.maxUsesInvalid'),
                  1,
                  Number.MAX_SAFE_INTEGER
                )}
              />
              <FieldTextInput
                id="PromoCodeForm.expiresAt"
                name="expiresAt"
                className={css.field}
                type="date"
                label={message('PromoCodeForm.expiresAtLabel')}
              />
            </div>
            <p className={css.hint}>
              <FormattedMessage
                id="PromoCodeForm.commissionHint"
                values={{ maxPercentage: maxPercent }}
              />
            </p>
            {errorMessage ? <p className={css.error}>{errorMessage}</p> : null}
            <PrimaryButton
              className={css.submitButton}
              type="submit"
              inProgress={inProgress}
              disabled={invalid || inProgress}
            >
              <FormattedMessage id="PromoCodeForm.submit" />
            </PrimaryButton>
          </Form>
        );
      }}
    />
  );
};

export default PromoCodeForm;
