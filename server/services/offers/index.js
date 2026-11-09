const { types } = require('sharetribe-flex-sdk');
const log = require('../../log');

const { Money } = types;

// default-purchase process (release 3)
const MAKE_OFFER = 'transition/customer-make-offer';
const PAY_COUNTER_OFFER = 'transition/request-payment-for-counter-offer';
const ACCEPT_COUNTER_OFFER = 'transition/customer-accept-counter-offer';
const MAKE_NEW_OFFER_AFTER_COUNTER = 'transition/customer-make-counter-offer';
const COUNTER_OFFERED_STATE = 'state/counter-offered';

const createOfferError = message => {
  const error = new Error(message);
  error.status = 400;
  error.statusText = message;
  error.data = {};
  return error;
};

/**
 * Fetches a transaction where the provider made a counter offer, and checks that the current
 * user is its customer and that it's about the same listing.
 *
 * Each offer is its own transaction (the customer's card is held for the offered price).
 * When the provider counters, that hold is released and the customer continues with a new
 * transaction: they pay the counter offer at once, or make a new offer.
 */
const getCounterOfferedTransaction = async ({ sdk, transactionId, listingId }) => {
  const [txResponse, currentUserResponse] = await Promise.all([
    sdk.transactions.show({ id: transactionId, include: ['listing', 'customer'] }),
    sdk.currentUser.show(),
  ]);
  const transaction = txResponse.data.data;
  const { state, metadata, lineItems } = transaction.attributes;
  const txListingId = transaction.relationships?.listing?.data?.id?.uuid;
  const txCustomerId = transaction.relationships?.customer?.data?.id?.uuid;
  const currentUserId = currentUserResponse.data.data.id.uuid;
  const requestedListingId = listingId?.uuid || listingId;

  if (
    state !== COUNTER_OFFERED_STATE ||
    txListingId !== requestedListingId ||
    txCustomerId !== currentUserId
  ) {
    throw createOfferError('Counter offer is not available');
  }

  const counterOffer = (metadata?.offers || []).filter(o => o.by === 'provider').pop();
  if (!Number.isInteger(counterOffer?.offerInSubunits) || counterOffer.offerInSubunits <= 0) {
    throw createOfferError('Counter offer is not available');
  }
  const itemLineItem = lineItems?.find(item => item.code === 'line-item/item' && !item.reversal);
  const quantity = itemLineItem?.quantity?.toNumber?.() || Number(itemLineItem?.quantity) || 1;

  return { transaction, counterOfferInSubunits: counterOffer.offerInSubunits, quantity };
};

/**
 * Price and metadata for transactions that start from an offer:
 * - customer-make-offer: the customer's offered price (per item)
 * - request-payment-for-counter-offer: the provider's counter offer (read from the transaction
 *   where it was made - never from the client)
 *
 * @param {Object} params
 * @param {Object} params.sdk Marketplace API SDK of the current user (the customer)
 * @param {string} params.transitionName
 * @param {Object} params.orderData client's order data
 * @param {Object} params.listingId
 * @param {string} params.currency
 * @returns {Promise<Object|null>} null for other transitions, otherwise:
 *   { offer: Money, quantity?: number, metadata: Object, transactionToClose?: { id, transition } }
 */
const getOfferPricing = async ({ sdk, transitionName, orderData, listingId, currency }) => {
  const { offerInSubunits, previousOfferTransactionId, counterOfferTransactionId } =
    orderData || {};

  if (transitionName === MAKE_OFFER) {
    if (!Number.isInteger(offerInSubunits) || offerInSubunits <= 0) {
      throw createOfferError('Offer is missing a valid amount');
    }
    // A new offer can follow a provider's counter offer (the customer offers again)
    const previous = previousOfferTransactionId
      ? await getCounterOfferedTransaction({
          sdk,
          transactionId: previousOfferTransactionId,
          listingId,
        })
      : null;

    return {
      offer: new Money(offerInSubunits, currency),
      metadata: {
        offers: [{ offerInSubunits, by: 'customer', transition: MAKE_OFFER }],
        ...(previous ? { previousOfferTransactionId: previous.transaction.id.uuid } : {}),
      },
      transactionToClose: previous
        ? { id: previous.transaction.id, transition: MAKE_NEW_OFFER_AFTER_COUNTER }
        : null,
    };
  }

  if (transitionName === PAY_COUNTER_OFFER) {
    const { transaction, counterOfferInSubunits, quantity } = await getCounterOfferedTransaction({
      sdk,
      transactionId: counterOfferTransactionId,
      listingId,
    });
    return {
      offer: new Money(counterOfferInSubunits, currency),
      quantity,
      metadata: {
        counterOfferOf: {
          transactionId: transaction.id.uuid,
          offerInSubunits: counterOfferInSubunits,
        },
      },
      transactionToClose: { id: transaction.id, transition: ACCEPT_COUNTER_OFFER },
    };
  }

  return null;
};

/**
 * Closes the earlier offer transaction after the customer continued in a new transaction.
 * A failure is logged but it doesn't fail the new order (the old one expires anyway).
 *
 * @param {Object} trustedSdk SDK of the current user
 * @param {{ id: Object, transition: string }} transactionToClose
 */
const closePreviousOfferTransaction = async (trustedSdk, transactionToClose) => {
  if (!transactionToClose) {
    return;
  }
  try {
    await trustedSdk.transactions.transition({
      id: transactionToClose.id,
      transition: transactionToClose.transition,
      params: {},
    });
  } catch (e) {
    log.error(e, 'close-previous-offer-transaction-failed', {
      transactionId: transactionToClose.id?.uuid,
    });
  }
};

module.exports = {
  getOfferPricing,
  closePreviousOfferTransaction,
};
