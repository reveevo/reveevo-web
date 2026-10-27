/**
 * Transaction process graph for product orders:
 *   - default-purchase
 */

/**
 * Transitions
 *
 * These strings must sync with values defined in Marketplace API,
 * since transaction objects given by API contain info about last transitions.
 * All the actions in API side happen in transitions,
 * so we need to understand what those strings mean.
 */

export const transitions = {
  // When a customer makes an order for a listing, a transaction is
  // created with the initial request-payment transition.
  // At this transition a PaymentIntent is created by Marketplace API.
  // After this transition, the actual payment must be made on client-side directly to Stripe.
  REQUEST_PAYMENT: 'transition/request-payment',

  // A customer can also initiate a transaction with an inquiry, and
  // then transition that with a request.
  INQUIRE: 'transition/inquire',
  REQUEST_PAYMENT_AFTER_INQUIRY: 'transition/request-payment-after-inquiry',

  // A customer can make an offer (a price per item) instead of buying with the listed price.
  // Provider can accept, decline, or make a counter offer. Customer can then accept, decline,
  // or make a new counter offer. Pending offers expire automatically.
  CUSTOMER_MAKE_OFFER: 'transition/customer-make-offer',
  PROVIDER_ACCEPT_OFFER: 'transition/provider-accept-offer',
  PROVIDER_DECLINE_OFFER: 'transition/provider-decline-offer',
  PROVIDER_MAKE_COUNTER_OFFER: 'transition/provider-make-counter-offer',
  CUSTOMER_WITHDRAW_OFFER: 'transition/customer-withdraw-offer',
  EXPIRE_OFFER: 'transition/expire-offer',
  CUSTOMER_ACCEPT_COUNTER_OFFER: 'transition/customer-accept-counter-offer',
  CUSTOMER_DECLINE_COUNTER_OFFER: 'transition/customer-decline-counter-offer',
  CUSTOMER_MAKE_COUNTER_OFFER: 'transition/customer-make-counter-offer',
  EXPIRE_COUNTER_OFFER: 'transition/expire-counter-offer',

  // When an offer is accepted, the customer pays the agreed price.
  // If that does not happen in time, the accepted offer expires.
  REQUEST_PAYMENT_AFTER_OFFER: 'transition/request-payment-after-offer',
  EXPIRE_ACCEPTED_OFFER: 'transition/expire-accepted-offer',

  // Stripe SDK might need to ask 3D security from customer, in a separate front-end step.
  // Therefore we need to make another transition to Marketplace API,
  // to tell that the payment is confirmed.
  CONFIRM_PAYMENT: 'transition/confirm-payment',

  // If the payment is not confirmed in the time limit set in transaction process (by default 15min)
  // the transaction will expire automatically.
  EXPIRE_PAYMENT: 'transition/expire-payment',

  // Provider or opeartor can mark the product shipped/delivered
  MARK_DELIVERED: 'transition/mark-delivered',
  OPERATOR_MARK_DELIVERED: 'transition/operator-mark-delivered',

  // Customer can mark the product received (e.g. picked up from provider)
  MARK_RECEIVED_FROM_PURCHASED: 'transition/mark-received-from-purchased',

  // Automatic cancellation happens if none marks the delivery happened
  AUTO_CANCEL: 'transition/auto-cancel',

  // Operator can cancel the purchase before product has been marked as delivered / received
  CANCEL: 'transition/cancel',

  // If provider has marked the product delivered (e.g. shipped),
  // customer can then mark the product received
  MARK_RECEIVED: 'transition/mark-received',

  // If customer doesn't mark the product received manually, it can happen automatically
  AUTO_MARK_RECEIVED: 'transition/auto-mark-received',

  // When provider has marked the product delivered, customer or operator can dispute the transaction
  DISPUTE: 'transition/dispute',
  OPERATOR_DISPUTE: 'transition/operator-dispute',

  // If nothing is done to disputed transaction it ends up to Canceled state
  AUTO_CANCEL_FROM_DISPUTED: 'transition/auto-cancel-from-disputed',

  // Operator can cancel disputed transaction manually
  CANCEL_FROM_DISPUTED: 'transition/cancel-from-disputed',

  // Operator can mark the disputed transaction as received
  MARK_RECEIVED_FROM_DISPUTED: 'transition/mark-received-from-disputed',

  // System moves transaction automatically from received state to complete state
  // This makes it possible to to add notifications to that single transition.
  AUTO_COMPLETE: 'transition/auto-complete',

  // Reviews are given through transaction transitions. Review 1 can be
  // by provider or customer, and review 2 will be the other party of
  // the transaction.
  REVIEW_1_BY_PROVIDER: 'transition/review-1-by-provider',
  REVIEW_2_BY_PROVIDER: 'transition/review-2-by-provider',
  REVIEW_1_BY_CUSTOMER: 'transition/review-1-by-customer',
  REVIEW_2_BY_CUSTOMER: 'transition/review-2-by-customer',
  EXPIRE_CUSTOMER_REVIEW_PERIOD: 'transition/expire-customer-review-period',
  EXPIRE_PROVIDER_REVIEW_PERIOD: 'transition/expire-provider-review-period',
  EXPIRE_REVIEW_PERIOD: 'transition/expire-review-period',
};

/**
 * States
 *
 * These constants are only for making it clear how transitions work together.
 * You should not use these constants outside of this file.
 *
 * Note: these states are not in sync with states used transaction process definitions
 *       in Marketplace API. Only last transitions are passed along transaction object.
 */

export const states = {
  INITIAL: 'initial',
  INQUIRY: 'inquiry',
  OFFER_PENDING: 'offer-pending',
  COUNTER_OFFER_PENDING: 'counter-offer-pending',
  OFFER_ACCEPTED: 'offer-accepted',
  OFFER_DECLINED: 'offer-declined',
  OFFER_WITHDRAWN: 'offer-withdrawn',
  OFFER_EXPIRED: 'offer-expired',
  PENDING_PAYMENT: 'pending-payment',
  PAYMENT_EXPIRED: 'payment-expired',
  PURCHASED: 'purchased',
  DELIVERED: 'delivered',
  RECEIVED: 'received',
  DISPUTED: 'disputed',
  CANCELED: 'canceled',
  COMPLETED: 'completed',
  REVIEWED: 'reviewed',
  REVIEWED_BY_CUSTOMER: 'reviewed-by-customer',
  REVIEWED_BY_PROVIDER: 'reviewed-by-provider',
};

/**
 * Description of transaction process graph
 *
 * You should keep this in sync with transaction process defined in Marketplace API
 *
 * Note: we don't use yet any state machine library,
 *       but this description format is following Xstate (FSM library)
 *       https://xstate.js.org/docs/
 */
export const graph = {
  // id is defined only to support Xstate format.
  // However if you have multiple transaction processes defined,
  // it is best to keep them in sync with transaction process aliases.
  id: 'default-purchase/release-1',

  // This 'initial' state is a starting point for new transaction
  initial: states.INITIAL,

  // States
  states: {
    [states.INITIAL]: {
      on: {
        [transitions.INQUIRE]: states.INQUIRY,
        [transitions.REQUEST_PAYMENT]: states.PENDING_PAYMENT,
        [transitions.CUSTOMER_MAKE_OFFER]: states.OFFER_PENDING,
      },
    },
    [states.INQUIRY]: {
      on: {
        [transitions.REQUEST_PAYMENT_AFTER_INQUIRY]: states.PENDING_PAYMENT,
      },
    },

    [states.OFFER_PENDING]: {
      on: {
        [transitions.PROVIDER_ACCEPT_OFFER]: states.OFFER_ACCEPTED,
        [transitions.PROVIDER_DECLINE_OFFER]: states.OFFER_DECLINED,
        [transitions.PROVIDER_MAKE_COUNTER_OFFER]: states.COUNTER_OFFER_PENDING,
        [transitions.CUSTOMER_WITHDRAW_OFFER]: states.OFFER_WITHDRAWN,
        [transitions.EXPIRE_OFFER]: states.OFFER_EXPIRED,
      },
    },
    [states.COUNTER_OFFER_PENDING]: {
      on: {
        [transitions.CUSTOMER_ACCEPT_COUNTER_OFFER]: states.OFFER_ACCEPTED,
        [transitions.CUSTOMER_DECLINE_COUNTER_OFFER]: states.OFFER_DECLINED,
        [transitions.CUSTOMER_MAKE_COUNTER_OFFER]: states.OFFER_PENDING,
        [transitions.EXPIRE_COUNTER_OFFER]: states.OFFER_EXPIRED,
      },
    },
    [states.OFFER_ACCEPTED]: {
      on: {
        [transitions.REQUEST_PAYMENT_AFTER_OFFER]: states.PENDING_PAYMENT,
        [transitions.EXPIRE_ACCEPTED_OFFER]: states.OFFER_EXPIRED,
      },
    },
    [states.OFFER_DECLINED]: {},
    [states.OFFER_WITHDRAWN]: {},
    [states.OFFER_EXPIRED]: {},

    [states.PENDING_PAYMENT]: {
      on: {
        [transitions.EXPIRE_PAYMENT]: states.PAYMENT_EXPIRED,
        [transitions.CONFIRM_PAYMENT]: states.PURCHASED,
      },
    },

    [states.PAYMENT_EXPIRED]: {},
    [states.PURCHASED]: {
      on: {
        [transitions.MARK_DELIVERED]: states.DELIVERED,
        [transitions.OPERATOR_MARK_DELIVERED]: states.DELIVERED,
        [transitions.MARK_RECEIVED_FROM_PURCHASED]: states.RECEIVED,
        [transitions.AUTO_CANCEL]: states.CANCELED,
        [transitions.CANCEL]: states.CANCELED,
      },
    },

    [states.CANCELED]: {},

    [states.DELIVERED]: {
      on: {
        [transitions.MARK_RECEIVED]: states.RECEIVED,
        [transitions.AUTO_MARK_RECEIVED]: states.RECEIVED,
        [transitions.DISPUTE]: states.DISPUTED,
        [transitions.OPERATOR_DISPUTE]: states.DISPUTED,
      },
    },

    [states.DISPUTED]: {
      on: {
        [transitions.AUTO_CANCEL_FROM_DISPUTED]: states.CANCELED,
        [transitions.CANCEL_FROM_DISPUTED]: states.CANCELED,
        [transitions.MARK_RECEIVED_FROM_DISPUTED]: states.RECEIVED,
      },
    },

    [states.RECEIVED]: {
      on: {
        [transitions.AUTO_COMPLETE]: states.COMPLETED,
      },
    },

    [states.COMPLETED]: {
      on: {
        [transitions.EXPIRE_REVIEW_PERIOD]: states.REVIEWED,
        [transitions.REVIEW_1_BY_CUSTOMER]: states.REVIEWED_BY_CUSTOMER,
        [transitions.REVIEW_1_BY_PROVIDER]: states.REVIEWED_BY_PROVIDER,
      },
    },

    [states.REVIEWED_BY_CUSTOMER]: {
      on: {
        [transitions.REVIEW_2_BY_PROVIDER]: states.REVIEWED,
        [transitions.EXPIRE_PROVIDER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED_BY_PROVIDER]: {
      on: {
        [transitions.REVIEW_2_BY_CUSTOMER]: states.REVIEWED,
        [transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD]: states.REVIEWED,
      },
    },
    [states.REVIEWED]: { type: 'final' },
  },
};

// Check if a transition is the kind that should be rendered
// when showing transition history (e.g. ActivityFeed)
// The first transition and most of the expiration transitions made by system are not relevant
export const isRelevantPastTransition = transition => {
  return [
    transitions.CUSTOMER_MAKE_OFFER,
    transitions.PROVIDER_ACCEPT_OFFER,
    transitions.PROVIDER_DECLINE_OFFER,
    transitions.PROVIDER_MAKE_COUNTER_OFFER,
    transitions.CUSTOMER_WITHDRAW_OFFER,
    transitions.EXPIRE_OFFER,
    transitions.CUSTOMER_ACCEPT_COUNTER_OFFER,
    transitions.CUSTOMER_DECLINE_COUNTER_OFFER,
    transitions.CUSTOMER_MAKE_COUNTER_OFFER,
    transitions.EXPIRE_COUNTER_OFFER,
    transitions.EXPIRE_ACCEPTED_OFFER,
    transitions.CONFIRM_PAYMENT,
    transitions.AUTO_CANCEL,
    transitions.CANCEL,
    transitions.MARK_DELIVERED,
    transitions.OPERATOR_MARK_DELIVERED,
    transitions.DISPUTE,
    transitions.OPERATOR_DISPUTE,
    transitions.AUTO_COMPLETE,
    transitions.AUTO_CANCEL_FROM_DISPUTED,
    transitions.CANCEL_FROM_DISPUTED,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
  ].includes(transition);
};
export const isCustomerReview = transition => {
  return [transitions.REVIEW_1_BY_CUSTOMER, transitions.REVIEW_2_BY_CUSTOMER].includes(transition);
};

export const isProviderReview = transition => {
  return [transitions.REVIEW_1_BY_PROVIDER, transitions.REVIEW_2_BY_PROVIDER].includes(transition);
};

// Check if the given transition is privileged.
//
// Privileged transitions need to be handled from a secure context,
// i.e. the backend. This helper is used to check if the transition
// should go through the local API endpoints, or if using JS SDK is
// enough.
export const isPrivileged = transition => {
  return [
    transitions.REQUEST_PAYMENT,
    transitions.REQUEST_PAYMENT_AFTER_INQUIRY,
    transitions.REQUEST_PAYMENT_AFTER_OFFER,
    transitions.CUSTOMER_MAKE_OFFER,
    transitions.PROVIDER_MAKE_COUNTER_OFFER,
    transitions.CUSTOMER_MAKE_COUNTER_OFFER,
  ].includes(transition);
};

// Check when transaction is completed (item is received and review notifications sent)
export const isCompleted = transition => {
  const txCompletedTransitions = [
    transitions.AUTO_COMPLETE,
    transitions.REVIEW_1_BY_CUSTOMER,
    transitions.REVIEW_1_BY_PROVIDER,
    transitions.REVIEW_2_BY_CUSTOMER,
    transitions.REVIEW_2_BY_PROVIDER,
    transitions.EXPIRE_REVIEW_PERIOD,
    transitions.EXPIRE_CUSTOMER_REVIEW_PERIOD,
    transitions.EXPIRE_PROVIDER_REVIEW_PERIOD,
  ];
  return txCompletedTransitions.includes(transition);
};

// Check when transaction is refunded (order did not happen)
// In these transitions action/stripe-refund-payment is called
export const isRefunded = transition => {
  const txRefundedTransitions = [
    transitions.EXPIRE_PAYMENT,
    transitions.CANCEL,
    transitions.AUTO_CANCEL,
    transitions.AUTO_CANCEL_FROM_DISPUTED,
    transitions.CANCEL_FROM_DISPUTED,
  ];
  return txRefundedTransitions.includes(transition);
};

export const statesNeedingProviderAttention = [states.OFFER_PENDING, states.PURCHASED];

export const statesNeedingCustomerAttention = [states.COUNTER_OFFER_PENDING, states.OFFER_ACCEPTED];

/////////////////////////////////////////////////////////////////////
// Offers                                                          //
// Each offer transition saves an entry to transaction's metadata: //
// metadata.offers: [{ offerInSubunits, by, transition }]          //
/////////////////////////////////////////////////////////////////////

// Transitions that set a new offer (i.e. add an entry to metadata.offers)
const offerTransitions = [
  transitions.CUSTOMER_MAKE_OFFER,
  transitions.PROVIDER_MAKE_COUNTER_OFFER,
  transitions.CUSTOMER_MAKE_COUNTER_OFFER,
];

/**
 * Checks if the offers array is valid against the (past) transitions array.
 *
 * @param {Array<Object>} transitions - transaction's transitions: [{ transition, by, createdAt }]
 * @param {Array<Object>} offers - metadata.offers: [{ offerInSubunits, by, transition }]
 * @returns {boolean}
 */
export const isValidNegotiationOffersArray = (transitions, offers) => {
  const pickedTransitions = (transitions || []).filter(t =>
    offerTransitions.includes(t.transition)
  );
  return (
    Array.isArray(offers) &&
    offers.length === pickedTransitions.length &&
    offers.every(
      (offer, i) =>
        offer.transition === pickedTransitions[i].transition && offer.by === pickedTransitions[i].by
    )
  );
};

/**
 * Checks if the state is one where an offer is waiting for a response.
 *
 * @param {string} state e.g. 'state/offer-pending'
 * @returns {boolean}
 */
export const isNegotiationState = state => {
  const unprefixedState = state?.indexOf('/') > -1 ? state.split('/')[1] : state;
  return [states.OFFER_PENDING, states.COUNTER_OFFER_PENDING].includes(unprefixedState);
};

/**
 * Adds offerInSubunits to the offer transitions, so that ActivityFeed can show the offered price.
 *
 * @param {Array<Object>} transitions
 * @param {Array<Object>} offers
 * @returns {Array<Object>}
 */
export const getTransitionsWithMatchingOffers = (transitions, offers) => {
  if (!isValidNegotiationOffersArray(transitions, offers)) {
    return transitions;
  }
  let offerIndex = 0;
  return transitions.map(t =>
    offerTransitions.includes(t.transition)
      ? { ...t, offerInSubunits: offers[offerIndex++].offerInSubunits }
      : t
  );
};
