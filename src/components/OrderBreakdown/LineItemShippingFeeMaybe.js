import React from 'react';
import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { LINE_ITEM_SHIPPING_FEE, propTypes } from '../../util/types';

import css from './OrderBreakdown.module.css';

/**
 * A component that renders the shipping fee as a line item.
 *
 * @component
 * @param {Object} props
 * @param {Array<propTypes.lineItem>} props.lineItems - The line items to render
 * @param {boolean} [props.showShippingAtCheckout] - Show "calculated at checkout" if there's no fee yet
 * @param {intlShape} props.intl - The intl object
 * @returns {JSX.Element}
 */
const LineItemShippingFeeMaybe = props => {
  const { lineItems, showShippingAtCheckout = false, intl } = props;

  const shippingFeeLineItem = lineItems.find(
    item => item.code === LINE_ITEM_SHIPPING_FEE && !item.reversal
  );

  // Shipping fee is calculated at checkout (it depends on the buyer's address),
  // so estimates before that show a placeholder row.
  return shippingFeeLineItem || showShippingAtCheckout ? (
    <div className={css.lineItem}>
      <span className={css.itemLabel}>
        <FormattedMessage id="OrderBreakdown.shippingFee" />
      </span>
      <span className={css.itemValue}>
        {shippingFeeLineItem ? (
          formatMoney(intl, shippingFeeLineItem.lineTotal)
        ) : (
          <FormattedMessage id="OrderBreakdown.shippingFeeAtCheckout" />
        )}
      </span>
    </div>
  ) : null;
};

export default LineItemShippingFeeMaybe;
