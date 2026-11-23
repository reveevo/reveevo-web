const crypto = require('crypto');

const { isValidCode, normalizeCode, promoCodeRef } = require('./codes');
const { PROMO_DISCOUNT_CODE } = require('./discount');
const { checkoutError, confirmUse, getUnusableReason, releaseUse, reserveUse } = require('./uses');

/**
 * Promo codes at checkout (initiate-privileged and transition-privileged). The customer's code
 * comes in orderData.promoCode. It's checked here, its discount is added to the line items, and
 * a use is counted when the order is placed.
 *
 * The use is tracked in Firestore (see uses.js). The transaction's protected data keeps the code
 * and the use id, so that the use can be given back if the provider declines the order (see
 * server/api/decline-order.js).
 */

// default-purchase process: the transitions where the customer pays (a code can be used)
const PROMO_CODE_TRANSITIONS = [
  'transition/request-payment',
  'transition/request-payment-after-inquiry',
  'transition/request-payment-after-offer',
];

/**
 * The promo code the customer entered, or null when none was entered (or the transition doesn't
 * take payment). Throws a 400 error ('promo-code-invalid', 'promo-code-expired' or
 * 'promo-code-used-up' as statusText) when the code can't be used.
 *
 * @param {Object} params
 * @param {string} [params.code] As entered
 * @param {string} params.transitionName
 * @param {Date} [params.now]
 * @returns {Promise<Object|null>} { id, code, discountType, percentage, amount, currency, redemptionId }
 */
const getCheckoutPromoCode = async ({ code, transitionName, now = new Date() }) => {
  if (!code || !PROMO_CODE_TRANSITIONS.includes(transitionName)) {
    return null;
  }
  const normalized = normalizeCode(code);
  if (!isValidCode(normalized)) {
    throw checkoutError('promo-code-invalid');
  }
  const doc = await promoCodeRef(normalized).get();
  const data = doc.exists ? doc.data() : null;
  const reason = getUnusableReason(data, now);
  if (reason) {
    throw checkoutError(reason);
  }
  const { discountType, percentage, amount, currency } = data;
  return {
    id: doc.id,
    code: data.code,
    discountType,
    percentage,
    amount,
    currency,
    // This order's use of the code
    redemptionId: crypto.randomUUID(),
  };
};

const getDiscountLineItem = lineItems =>
  (lineItems || []).find(i => i.code === PROMO_DISCOUNT_CODE);

/**
 * The applied promo code for the transaction's protected data, or {}.
 *
 * @param {Object|null} promoCode
 * @param {Array<Object>} lineItems
 * @returns {Object} { promoCode: { id, redemptionId, code, discount, currency } } or {}
 */
const getPromoCodeProtectedData = (promoCode, lineItems) => {
  const discountItem = getDiscountLineItem(lineItems);
  return promoCode && discountItem
    ? {
        promoCode: {
          id: promoCode.id,
          redemptionId: promoCode.redemptionId,
          code: promoCode.code,
          discount: Math.abs(discountItem.unitPrice.amount),
          currency: discountItem.unitPrice.currency,
        },
      }
    : {};
};

/**
 * Place the order, counting a use of the promo code: a use is reserved first (which enforces
 * the usage limit), confirmed with the transaction id if the order was placed, and given back if
 * it wasn't. Price previews (speculative requests) don't count.
 *
 * @param {Object} params
 * @param {Object|null} params.promoCode From getCheckoutPromoCode
 * @param {Array<Object>} params.lineItems
 * @param {boolean} params.isSpeculative
 * @param {Object} params.details Stored with the use (customerId, listingId)
 * @param {Function} makeRequest () => Promise of the SDK response
 * @returns {Promise<Object>} The SDK response
 */
const withPromoCodeUse = async ({ promoCode, lineItems, isSpeculative, details }, makeRequest) => {
  const discountItem = getDiscountLineItem(lineItems);
  if (!promoCode || !discountItem || isSpeculative) {
    return makeRequest();
  }

  await reserveUse(promoCode, {
    ...details,
    discount: Math.abs(discountItem.unitPrice.amount),
    currency: discountItem.unitPrice.currency,
  });

  let response;
  try {
    response = await makeRequest();
  } catch (e) {
    await releaseUse(promoCode).catch(releaseError =>
      console.error('Failed to release the promo code use', promoCode.id, releaseError)
    );
    throw e;
  }

  // The order is placed: a failure here only affects the usage history
  const transactionId = response?.data?.data?.id?.uuid || null;
  await confirmUse(promoCode, transactionId).catch(e =>
    console.error('Failed to confirm the promo code use', promoCode.id, e)
  );
  return response;
};

module.exports = {
  PROMO_CODE_TRANSITIONS,
  getCheckoutPromoCode,
  getPromoCodeProtectedData,
  withPromoCodeUse,
};
