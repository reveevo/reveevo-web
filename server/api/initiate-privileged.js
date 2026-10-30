const sharetribeSdk = require('sharetribe-flex-sdk');
const { assertExpectedPayinTotal } = require('../api-util/assertExpectedPayinTotal');
const { transactionLineItems } = require('../api-util/lineItems');
const { isIntentionToMakeOffer, pickOfferOrderData } = require('../api-util/negotiation');
const { getShippingQuote, needsShippingQuote } = require('../services/shipping');
const {
  createCookieTokenStore,
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');

const { Money } = sharetribeSdk.types;

const listingPromise = (sdk, id) => sdk.listings.show({ id, include: ['author'] });

// default-purchase process: the customer makes an offer on a product listing
const isPurchaseOffer = transitionName => transitionName === 'transition/customer-make-offer';

const getFullOrderData = (clientOrderData, bodyParams, currency) => {
  // The offer price and the shipping fee are only ever set here on the server.
  // Ignore them if the client sends them.
  const { offer, shippingFee, ...orderData } = clientOrderData || {};
  const { offerInSubunits } = orderData;
  const transitionName = bodyParams.transition;

  if (isPurchaseOffer(transitionName) && !isIntentionToMakeOffer(offerInSubunits, transitionName)) {
    const error = new Error('Offer is missing a valid amount');
    error.status = 400;
    error.statusText = 'Offer is missing a valid amount';
    error.data = {};
    throw error;
  }

  return isIntentionToMakeOffer(offerInSubunits, transitionName)
    ? {
        ...orderData,
        ...bodyParams.params,
        currency,
        offer: new Money(offerInSubunits, currency),
      }
    : { ...orderData, ...bodyParams.params };
};

const getMetadata = (orderData, transition) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for now, the actor is always "provider".
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  // Purchase offers save the order details, so that they stay the same through the negotiation.
  const offerOrderDataMaybe = isPurchaseOffer(transition)
    ? { offerOrderData: pickOfferOrderData(orderData) }
    : {};

  return isIntentionToMakeOffer(offerInSubunits, transition)
    ? {
        metadata: {
          offers: [
            {
              offerInSubunits,
              by,
              transition,
            },
          ],
          ...offerOrderDataMaybe,
        },
      }
    : {};
};

module.exports = (req, res) => {
  const { isSpeculative, orderData, bodyParams, queryParams } = req.body || {};
  const transitionName = bodyParams.transition;
  // Share one cookie token store so a refresh during listings.show is reused for exchangeToken.
  const tokenStore = createCookieTokenStore(req, res);
  const sdk = getSdk(req, res, tokenStore);
  let lineItems = null;
  let metadataMaybe = {};
  let deliveryMaybe = {};

  Promise.all([listingPromise(sdk, bodyParams?.params?.listingId), fetchCommission(sdk)])
    .then(async ([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const currency = listing.attributes.price?.currency || orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      // Shipped purchases: the fee depends on the vehicle and the distance between the parties.
      const shippingQuote = needsShippingQuote(transitionName, orderData)
        ? await getShippingQuote({
            sdk,
            listing,
            providerId: listing.relationships?.author?.data?.id,
          })
        : null;
      deliveryMaybe = shippingQuote ? { delivery: shippingQuote.delivery } : {};

      lineItems = transactionLineItems(
        listing,
        {
          ...getFullOrderData(orderData, bodyParams, currency),
          // Shipping fee is set last, so that client's params can't override it.
          shippingFee: shippingQuote?.shippingFee,
        },
        providerCommission,
        customerCommission
      );

      // If the client sends expectedPayinTotal (checkout payment flows), ensure it
      assertExpectedPayinTotal(lineItems, orderData?.expectedPayinTotal);

      metadataMaybe = getMetadata(orderData, transitionName);

      return getTrustedSdk(req, res, tokenStore);
    })
    .then(trustedSdk => {
      const { params } = bodyParams;
      // Both delivery addresses are saved to the transaction, so that both parties see them.
      const protectedDataMaybe = Object.keys(deliveryMaybe).length
        ? { protectedData: { ...params?.protectedData, ...deliveryMaybe } }
        : {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...params,
          ...protectedDataMaybe,
          lineItems,
          ...metadataMaybe,
        },
      };

      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.initiate(body, queryParams);
    })
    .then(apiResponse => {
      const { status, statusText, data } = apiResponse;
      res
        .status(status)
        .set('Content-Type', 'application/transit+json')
        .send(
          serialize({
            status,
            statusText,
            data,
          })
        )
        .end();
    })
    .catch(e => {
      handleError(res, e);
    });
};
