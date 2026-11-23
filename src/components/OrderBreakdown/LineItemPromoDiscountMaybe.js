import React from 'react';
import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { LINE_ITEM_PROMO_DISCOUNT, propTypes } from '../../util/types';

import css from './OrderBreakdown.module.css';

/**
 * A component that renders a promo code's discount as a line item. Reveevo pays the discount
 * from its commission, so only the customer sees it (the provider's payout is the same).
 *
 * @component
 * @param {Object} props
 * @param {Array<propTypes.lineItem>} props.lineItems - The line items to render
 * @param {boolean} props.isCustomer - Whether the breakdown is shown to the customer
 * @param {intlShape} props.intl - The intl object
 * @returns {JSX.Element}
 */
const LineItemPromoDiscountMaybe = props => {
  const { lineItems, isCustomer, intl } = props;
  const discountLineItem = lineItems.find(
    item => item.code === LINE_ITEM_PROMO_DISCOUNT && !item.reversal
  );

  return isCustomer && discountLineItem ? (
    <div className={css.lineItem}>
      <span className={css.itemLabel}>
        <FormattedMessage id="OrderBreakdown.promoDiscount" />
      </span>
      <span className={css.itemValue}>{formatMoney(intl, discountLineItem.lineTotal)}</span>
    </div>
  ) : null;
};

export default LineItemPromoDiscountMaybe;
