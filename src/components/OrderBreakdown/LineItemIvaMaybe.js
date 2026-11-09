import React from 'react';
import { FormattedMessage, intlShape } from '../../util/reactIntl';
import { formatMoney } from '../../util/currency';
import { LINE_ITEM_IVA, propTypes } from '../../util/types';

import css from './OrderBreakdown.module.css';

/**
 * A component that renders the IVA (Mexican VAT) as a line item.
 * IVA is charged on the shipping fee and the marketplace commissions, and the customer pays it.
 *
 * @component
 * @param {Object} props
 * @param {Array<propTypes.lineItem>} props.lineItems - The line items to render
 * @param {boolean} props.isCustomer - Whether the breakdown is shown to the customer
 * @param {intlShape} props.intl - The intl object
 * @returns {JSX.Element}
 */
const LineItemIvaMaybe = props => {
  const { lineItems, isCustomer, intl } = props;
  const ivaLineItem = lineItems.find(item => item.code === LINE_ITEM_IVA && !item.reversal);

  return isCustomer && ivaLineItem ? (
    <div className={css.lineItem}>
      <span className={css.itemLabel}>
        <FormattedMessage id="OrderBreakdown.iva" />
      </span>
      <span className={css.itemValue}>{formatMoney(intl, ivaLineItem.lineTotal)}</span>
    </div>
  ) : null;
};

export default LineItemIvaMaybe;
