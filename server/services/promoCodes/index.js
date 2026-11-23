// Promo codes created by Reveevo's admins and used by customers at checkout (Firestore).
const codes = require('./codes');
const discount = require('./discount');
const uses = require('./uses');
const checkout = require('./checkout');

/**
 * The provider declined the order: the promo code use (if any) is given back, with a 'returned'
 * entry in the code's history. The code and the use id are read from the transaction's protected
 * data, and only the order that made the use can give it back (see uses.returnUse).
 *
 * @param {Object} transaction The declined transaction (Marketplace API entity)
 * @param {string} transition e.g. 'transition/provider-decline-order'
 * @returns {Promise<boolean>} Whether a use was given back
 */
const returnPromoCodeUseMaybe = (transaction, transition) => {
  const { id, redemptionId } = transaction?.attributes?.protectedData?.promoCode || {};
  const transactionId = transaction?.id?.uuid;
  return id && redemptionId && transactionId
    ? uses.returnUse({ promoCodeId: id, redemptionId, transactionId, transition })
    : Promise.resolve(false);
};

module.exports = {
  ...codes,
  ...discount,
  ...uses,
  ...checkout,
  returnPromoCodeUseMaybe,
};
