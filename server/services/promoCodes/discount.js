const { types } = require('sharetribe-flex-sdk');
const { calculateLineTotal } = require('../../api-util/lineItemHelpers');
const { DISCOUNT_PERCENTAGE } = require('./constants');

const { Money } = types;

const PROMO_DISCOUNT_CODE = 'line-item/promo-discount';
const COMMISSION_CODES = ['line-item/provider-commission', 'line-item/customer-commission'];

/**
 * Reveevo's commission on the order (provider + customer commission), in minor units.
 *
 * @param {Array<Object>} lineItems
 * @returns {number}
 */
const getCommissionTotal = lineItems =>
  (lineItems || [])
    .filter(item => COMMISSION_CODES.includes(item.code))
    .reduce((sum, item) => sum + Math.abs(calculateLineTotal(item).amount), 0);

/**
 * The highest percentage a promo code can have: Reveevo's total commission percentage
 * (provider + customer), from the hosted commission config.
 *
 * @param {Object} [providerCommission] { percentage }
 * @param {Object} [customerCommission] { percentage }
 * @returns {number}
 */
const getMaxPromoPercentage = (providerCommission, customerCommission) =>
  (Number(providerCommission?.percentage) || 0) + (Number(customerCommission?.percentage) || 0);

/**
 * The promo code's discount line item, or [] when there's no discount. The discount is taken
 * from the item price (the first line item): a percentage of it, or a fixed amount. Reveevo
 * pays it from its commission, so it's at most the order's commission, and only the customer's
 * price is reduced (the provider's payout stays the same).
 *
 * @param {Array<Object>} lineItems The order's line items (item first, commissions included)
 * @param {Object|null} promoCode { discountType, percentage, amount, currency }
 * @param {string} currency
 * @returns {Array<Object>} [] or [discountLineItem]
 */
const getPromoDiscountLineItemMaybe = (lineItems, promoCode, currency) => {
  if (!promoCode || !lineItems?.length) {
    return [];
  }
  const itemTotal = calculateLineTotal(lineItems[0]).amount;
  const discount =
    promoCode.discountType === DISCOUNT_PERCENTAGE
      ? Math.round((itemTotal * promoCode.percentage) / 100)
      : promoCode.currency === currency
      ? promoCode.amount
      : 0;
  const cappedDiscount = Math.min(discount, getCommissionTotal(lineItems));

  return cappedDiscount > 0
    ? [
        {
          code: PROMO_DISCOUNT_CODE,
          unitPrice: new Money(-cappedDiscount, currency),
          quantity: 1,
          includeFor: ['customer'],
        },
      ]
    : [];
};

module.exports = {
  PROMO_DISCOUNT_CODE,
  getCommissionTotal,
  getMaxPromoPercentage,
  getPromoDiscountLineItemMaybe,
};
