import React, { useState } from 'react';
import classNames from 'classnames';

import { FormattedMessage, useIntl } from '../../../util/reactIntl';

import { SecondaryButton } from '../../../components';

import css from './PromoCodeField.module.css';

// Error codes from the app's server (statusText), see server/services/promoCodes/checkout.js
const ERROR_MESSAGE_IDS = {
  'promo-code-invalid': 'PromoCodeField.error.invalid',
  'promo-code-expired': 'PromoCodeField.error.expired',
  'promo-code-used-up': 'PromoCodeField.error.usedUp',
  'too-many-requests': 'PromoCodeField.error.tooManyRequests',
  'feature-unavailable': 'PromoCodeField.error.unavailable',
};

/**
 * Promo code at checkout: the customer enters a code and applies it. The app's server checks
 * the code and adds the discount to the price breakdown.
 *
 * @component
 * @param {Object} props
 * @param {string} [props.className]
 * @param {string} [props.appliedCode] The code that is applied
 * @param {string} [props.errorCode] Why the last code couldn't be applied
 * @param {boolean} [props.disabled]
 * @param {Function} props.onApply Called with the code, or null to remove the applied code
 * @returns {JSX.Element}
 */
const PromoCodeField = props => {
  const intl = useIntl();
  const { className, appliedCode, errorCode, disabled, onApply } = props;
  // The applied code stays in the field: a different code replaces it, an empty field removes it
  const [value, setValue] = useState(appliedCode || '');
  const code = value.trim().toUpperCase();
  const isChanged = code !== (appliedCode || '');

  const handleApply = e => {
    e.preventDefault();
    if (!disabled && isChanged) {
      onApply(code || null);
    }
  };
  const errorId = errorCode ? ERROR_MESSAGE_IDS[errorCode] || 'PromoCodeField.error.invalid' : null;

  return (
    // Not a <form>: the field is next to the payment form, and forms can't be nested
    <div className={classNames(css.root, className)}>
      <label className={css.label} htmlFor="CheckoutPage.promoCode">
        <FormattedMessage id="PromoCodeField.label" />
      </label>
      <div className={css.row}>
        <input
          id="CheckoutPage.promoCode"
          className={css.input}
          type="text"
          value={value}
          autoComplete="off"
          maxLength={20}
          placeholder={intl.formatMessage({ id: 'PromoCodeField.placeholder' })}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e =>
            // Not while an input method (e.g. Japanese) is composing text
            e.key === 'Enter' && !e.nativeEvent.isComposing ? handleApply(e) : null
          }
          aria-invalid={!!errorId}
          aria-describedby={errorId ? 'CheckoutPage.promoCodeError' : undefined}
        />
        <SecondaryButton
          className={css.applyButton}
          type="button"
          disabled={disabled || !isChanged}
          onClick={handleApply}
        >
          <FormattedMessage
            id={code || !appliedCode ? 'PromoCodeField.apply' : 'PromoCodeField.remove'}
          />
        </SecondaryButton>
      </div>
      {errorId ? (
        <p id="CheckoutPage.promoCodeError" className={css.error} role="alert">
          <FormattedMessage id={errorId} />
        </p>
      ) : appliedCode ? (
        <p className={css.applied}>
          <FormattedMessage id="PromoCodeField.applied" values={{ code: appliedCode }} />
        </p>
      ) : null}
    </div>
  );
};

export default PromoCodeField;
