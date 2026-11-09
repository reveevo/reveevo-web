const { types } = require('sharetribe-flex-sdk');
const { calculateLineTotal } = require('../../api-util/lineItemHelpers');

const { Money } = types;

// Mexican VAT (IVA)
const IVA_RATE = 0.16;
const IVA_LINE_ITEM_CODE = 'line-item/iva';

// IVA is charged on Reveevo's services: the shipping it organizes and its commissions
// (both the provider's and the customer's commission).
const TAXED_LINE_ITEM_CODES = [
  'line-item/shipping-fee',
  'line-item/provider-commission',
  'line-item/customer-commission',
];

/**
 * Returns the IVA line item (16% of shipping fee + commissions), or an empty array if there's
 * nothing to tax. The customer pays it and it's not included in the provider's payout,
 * so it goes to the marketplace.
 *
 * @param {Array<Object>} lineItems line items of the order (without IVA)
 * @param {string} currency
 * @returns {Array<Object>} [] or [ivaLineItem]
 */
const getIvaLineItemMaybe = (lineItems, currency) => {
  const taxableAmount = lineItems
    .filter(item => TAXED_LINE_ITEM_CODES.includes(item.code))
    .reduce((sum, item) => sum + Math.abs(calculateLineTotal(item).amount), 0);
  const ivaAmount = Math.round(taxableAmount * IVA_RATE);

  return ivaAmount > 0
    ? [
        {
          code: IVA_LINE_ITEM_CODE,
          unitPrice: new Money(ivaAmount, currency),
          quantity: 1,
          includeFor: ['customer'],
        },
      ]
    : [];
};

module.exports = { IVA_RATE, IVA_LINE_ITEM_CODE, getIvaLineItemMaybe };
