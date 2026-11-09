// default-negotiation process: transitions that make the first offer
// default-purchase process: 'transition/customer-make-offer'
const makeOfferTransitions = [
  'transition/make-offer',
  'transition/make-offer-after-inquiry',
  'transition/make-offer-from-request',
  'transition/customer-make-offer',
];

// default-negotiation process: transitions that update the offer
const updateOfferTransitions = ['transition/update-offer', 'transition/update-from-update-pending'];

// default-negotiation & default-purchase processes: transitions that make a counter offer
const counterOfferTransitions = [
  'transition/customer-make-counter-offer',
  'transition/provider-make-counter-offer',
];

// default-negotiation process: transitions that revoke a counter offer
const revokeCounterOfferTransitions = [
  'transition/customer-withdraw-counter-offer',
  'transition/provider-reject-counter-offer',
];

// default-purchase process: transitions that pay the latest (accepted) offer
const payAcceptedOfferTransitions = ['transition/request-payment-after-offer'];

// default-negotiation process: transitions that affect pricing on negotiation loop
const offerTransitionsInNegotiationProcess = [
  ...makeOfferTransitions,
  ...updateOfferTransitions,
  ...counterOfferTransitions,
  ...revokeCounterOfferTransitions,
];

/**
 * @typedef {Object} NegotiationOffer
 * @property {string} transition - The transition name that was triggered to make this offer
 * @property {string} by - The actor who made the offer ('provider' or 'customer')
 * @property {number} offerInSubunits - The offer amount in subunits (smallest currency unit)
 */

/**
 * @typedef {Object} TransitionRecord
 * @property {string} transition - The transition name
 * @property {string} by - The actor who made the transition ('provider' or 'customer')
 * @property {string} createdAt - ISO timestamp when the transition was created
 */

/**
 * Checks if the transition is a make offer transition and if the offer is greater than 0.
 *
 * @param {number} offerInSubunits
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isIntentionToMakeOffer = (offerInSubunits, transitionName) => {
  const isIntentionToMakeOffer = makeOfferTransitions.includes(transitionName);
  const hasOffer = offerInSubunits > 0;
  return isIntentionToMakeOffer && hasOffer;
};
/**
 * Checks if the transition is a make counter offer transition and if the offer is greater than 0.
 *
 * @param {number} offerInSubunits
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isIntentionToMakeCounterOffer = (offerInSubunits, transitionName) => {
  const isIntentionToMakeCounterOffer = counterOfferTransitions.includes(transitionName);
  const hasOffer = offerInSubunits > 0;
  return isIntentionToMakeCounterOffer && hasOffer;
};
/**
 * Checks if the transition is a update offer transition.
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isIntentionToUpdateOffer = (offerInSubunits, transitionName) => {
  const isIntentionToUpdateOffer = updateOfferTransitions.includes(transitionName);
  const hasOffer = offerInSubunits > 0;
  return isIntentionToUpdateOffer && hasOffer;
};
/**
 * Checks if the transition is a revoke counter offer transition.
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isIntentionToRevokeCounterOffer = transitionName => {
  return revokeCounterOfferTransitions.includes(transitionName);
};

const filterRelevantTransitions = (transitions, relevantTransitions) => {
  return transitions.filter(t => relevantTransitions.includes(t.transition));
};
const isValidNegotiationOffersArray = (offers, transitions, relevantTransitions) => {
  const pickedTransitions = filterRelevantTransitions(transitions, relevantTransitions);
  const isOffersAnArray = !!offers && Array.isArray(offers);

  // First check if we have the same number of offers and transitions
  if (!isOffersAnArray || offers.length !== pickedTransitions.length) {
    return false;
  }

  // Then verify that each offer corresponds to the transition at the same index
  // and that the order matches
  for (let i = 0; i < offers.length; i++) {
    const offer = offers[i];
    const transition = pickedTransitions[i];

    // Check if the offer's transition and actor match the transition at the same index
    if (offer.transition !== transition.transition || offer.by !== transition.by) {
      return false;
    }
  }

  return true;
};

/**
 * Throws an error if the negotiation offers array is invalid.
 * Validation is done by reducing transitions array to only include relevant transitions (that set offers)
 * and then checking that transitions match with the offers array.
 *
 * @param {string} transitionName
 * @param {Array<NegotiationOffer>} offers - Array of negotiation offers
 * @param {Array<TransitionRecord>} transitions - Array of transition records
 */
exports.throwErrorIfNegotiationOfferHasInvalidHistory = (transitionName, offers, transitions) => {
  // const isNegotiationProcess = transaction.attributes.processName === 'default-negotiation';
  const isRelevantTransition = offerTransitionsInNegotiationProcess.includes(transitionName);

  if (
    isRelevantTransition &&
    !isValidNegotiationOffersArray(offers, transitions, offerTransitionsInNegotiationProcess)
  ) {
    const error = new Error('Past negotiation offers are invalid');
    error.status = 400;
    error.statusText = 'Past negotiation offers are invalid';
    error.data = {
      offers: offers,
      relevantTransitions: filterRelevantTransitions(
        transitions,
        offerTransitionsInNegotiationProcess
      ),
    };
    throw error;
  }
};

const getPreviousOffer = offers => {
  if (offers?.length < 2) {
    const error = new Error('Past negotiation offers are invalid');
    error.status = 400;
    error.statusText = 'Past negotiation offers are invalid';
    error.data = {
      offers: offers,
    };
    throw error;
  }
  return offers[offers.length - 2];
};

/**
 * Returns the offerInSubunits from the previous offer.
 *
 * @param {Array<NegotiationOffer>} offers - Array of negotiation offers
 * @returns {number} offer from the previous offer (in subunits)
 */
exports.getAmountFromPreviousOffer = offers => {
  const offer = getPreviousOffer(offers);
  return offer.offerInSubunits;
};

/**
 * Adds an offer to the offers array in the metadata of a transaction.
 *
 * @param {Object} metadata - Transaction's metadata object
 * @param {NegotiationOffer} offer - The offer to add to the metadata
 * @returns {Object} The updated metadata object
 */
exports.addOfferToMetadata = (metadata, offer) => {
  const existingOffers = metadata?.offers || [];
  return !!offer && metadata
    ? {
        metadata: {
          ...metadata,
          offers: [...existingOffers, offer],
        },
      }
    : metadata
    ? { metadata }
    : {};
};

/**
 * Checks if the transition pays for an offer that both parties have accepted.
 * The price of such a transition must come from the stored offers - never from the client.
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
exports.isIntentionToPayAcceptedOffer = transitionName => {
  return payAcceptedOfferTransitions.includes(transitionName);
};

/**
 * Returns the amount of the latest offer, after verifying that the offers array
 * matches the transaction's transition history.
 *
 * @param {Array<NegotiationOffer>} offers - Array of negotiation offers
 * @param {Array<TransitionRecord>} transitions - Array of transition records
 * @returns {number} the accepted offer (in subunits)
 */
exports.getAcceptedOfferAmount = (offers, transitions) => {
  const hasValidHistory = isValidNegotiationOffersArray(
    offers,
    transitions,
    offerTransitionsInNegotiationProcess
  );
  const latestOffer = hasValidHistory ? offers[offers.length - 1] : null;

  if (!latestOffer) {
    const error = new Error('Accepted offer is missing or invalid');
    error.status = 400;
    error.statusText = 'Accepted offer is missing or invalid';
    error.data = { offers };
    throw error;
  }
  return latestOffer.offerInSubunits;
};

/**
 * The quantity of a purchase offer is decided when the customer makes the offer.
 * It's saved to transaction's metadata, which only privileged calls can change,
 * so later offers and the payment can't alter how many items the offer is for.
 * Note: the delivery method is chosen when the accepted offer is paid (like after an inquiry).
 *
 * @param {Object} metadata - Transaction's metadata
 * @returns {Object} e.g. { stockReservationQuantity: 2 } or {}
 */
exports.getOfferOrderData = metadata => {
  const { stockReservationQuantity } = metadata?.offerOrderData || {};
  return Number.isInteger(stockReservationQuantity) ? { stockReservationQuantity } : {};
};

/**
 * Picks and validates the order details for a new purchase offer from client's orderData.
 *
 * @param {Object} orderData
 * @returns {Object} e.g. { stockReservationQuantity: 2 }
 */
exports.pickOfferOrderData = orderData => {
  const { stockReservationQuantity } = orderData || {};
  if (!Number.isInteger(stockReservationQuantity) || stockReservationQuantity < 1) {
    const error = new Error('Offer is missing a valid quantity');
    error.status = 400;
    error.statusText = 'Offer is missing a valid quantity';
    error.data = {};
    throw error;
  }
  return { stockReservationQuantity };
};
