// Reveevo: offers on product listings (default-purchase process).
// The buyer and the seller can make at most MAX_OFFERS_PER_TRANSACTION offers in total
// (the first offer included), so that negotiations don't go on forever.
// Note: keep in sync with MAX_OFFERS_PER_TRANSACTION in src/transactions/transactionProcessPurchase.js
const MAX_OFFERS_PER_TRANSACTION = 10;
const OFFER_LIMIT_REACHED = 'offer-limit-reached';

const PURCHASE_PROCESS_NAME = 'default-purchase';
const COUNTER_OFFER_TRANSITIONS = [
  'transition/provider-make-counter-offer',
  'transition/customer-make-counter-offer',
];

/**
 * Throws a 400 error (statusText: 'offer-limit-reached') if a counter offer would go over the
 * offer limit of a purchase transaction.
 *
 * @param {Object} params
 * @param {string} params.processName transaction's process name
 * @param {string} params.transitionName
 * @param {Array<Object>} params.existingOffers offers saved to transaction's metadata
 */
const assertOfferLimit = ({ processName, transitionName, existingOffers }) => {
  const isPurchaseCounterOffer =
    processName === PURCHASE_PROCESS_NAME && COUNTER_OFFER_TRANSITIONS.includes(transitionName);
  if (isPurchaseCounterOffer && (existingOffers?.length || 0) >= MAX_OFFERS_PER_TRANSACTION) {
    const error = new Error(OFFER_LIMIT_REACHED);
    error.status = 400;
    error.statusText = OFFER_LIMIT_REACHED;
    error.data = { code: OFFER_LIMIT_REACHED, max: MAX_OFFERS_PER_TRANSACTION };
    throw error;
  }
};

module.exports = { MAX_OFFERS_PER_TRANSACTION, OFFER_LIMIT_REACHED, assertOfferLimit };
