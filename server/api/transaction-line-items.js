const { types } = require('sharetribe-flex-sdk');
const { transactionLineItems } = require('../api-util/lineItems');
const { getSdk, handleError, serialize, fetchCommission } = require('../api-util/sdk');
const { constructValidLineItems } = require('../api-util/lineItemHelpers');
const { getAcceptedOfferAmount, getOfferOrderData } = require('../api-util/negotiation');

const { Money } = types;

// default-purchase process: when an accepted offer is about to be paid, the line items are
// priced with the offer. The offer is read from the transaction - never from the client.
const getAcceptedOfferOrderDataMaybe = (sdk, offerTransactionId, listingId) => {
  if (!offerTransactionId) {
    return Promise.resolve({});
  }
  return sdk.transactions.show({ id: offerTransactionId, include: ['listing'] }).then(response => {
    const transaction = response.data.data;
    const { state, metadata, transitions, payinTotal } = transaction.attributes;
    const txListingId = transaction.relationships?.listing?.data?.id?.uuid;

    if (state !== 'state/offer-accepted' || txListingId !== listingId?.uuid) {
      const error = new Error('Transaction does not have an accepted offer for this listing');
      error.status = 400;
      error.statusText = 'Transaction does not have an accepted offer for this listing';
      error.data = {};
      throw error;
    }

    const offerInSubunits = getAcceptedOfferAmount(metadata?.offers, transitions);
    return {
      ...getOfferOrderData(metadata),
      offer: new Money(offerInSubunits, payinTotal.currency),
    };
  });
};

module.exports = (req, res) => {
  const { isOwnListing, listingId, orderData } = req.body || {};
  // The offer price is only ever set here on the server - ignore it if the client sends one.
  const { offer, offerTransactionId, ...clientOrderData } = orderData || {};

  const sdk = getSdk(req, res);

  const listingPromise = () =>
    isOwnListing ? sdk.ownListings.show({ id: listingId }) : sdk.listings.show({ id: listingId });

  Promise.all([
    listingPromise(),
    fetchCommission(sdk),
    getAcceptedOfferOrderDataMaybe(sdk, offerTransactionId, listingId),
  ])
    .then(([showListingResponse, fetchAssetsResponse, acceptedOfferOrderData]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      const lineItems = transactionLineItems(
        listing,
        { ...clientOrderData, ...acceptedOfferOrderData },
        providerCommission,
        customerCommission
      );

      // Because we are using returned lineItems directly in this template we need to use the helper function
      // to add some attributes like lineTotal and reversal that Marketplace API also adds to the response.
      const validLineItems = constructValidLineItems(lineItems);

      res
        .status(200)
        .set('Content-Type', 'application/transit+json')
        .send(serialize({ data: validLineItems }))
        .end();
    })
    .catch(e => {
      handleError(res, e);
    });
};
