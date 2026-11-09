const sharetribeSdk = require('sharetribe-flex-sdk');
const { assertExpectedPayinTotal } = require('../api-util/assertExpectedPayinTotal');
const { transactionLineItems } = require('../api-util/lineItems');
const { isIntentionToMakeOffer } = require('../api-util/negotiation');
const { getShippingQuote, needsShippingQuote } = require('../services/shipping');
const { getOfferPricing, closePreviousOfferTransaction } = require('../services/offers');
const { assertEmailVerified, requiresVerifiedEmail } = require('../services/users');
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

// default-negotiation process: the provider makes the first offer (offer is saved to metadata)
const getNegotiationOfferPricing = (orderData, transitionName, currency) => {
  const { actor, offerInSubunits } = orderData || {};
  const by = ['provider', 'customer'].includes(actor) ? actor : null;
  return isIntentionToMakeOffer(offerInSubunits, transitionName)
    ? {
        offer: new Money(offerInSubunits, currency),
        metadata: { offers: [{ offerInSubunits, by, transition: transitionName }] },
      }
    : null;
};

module.exports = (req, res) => {
  const { isSpeculative, orderData: clientOrderData, bodyParams, queryParams } = req.body || {};
  const transitionName = bodyParams.transition;
  // The offer price and the shipping fee are only ever set here on the server.
  // Ignore them if the client sends them.
  const { offer, shippingFee, ...orderData } = clientOrderData || {};

  // Share one cookie token store so a refresh during listings.show is reused for exchangeToken.
  const tokenStore = createCookieTokenStore(req, res);
  const sdk = getSdk(req, res, tokenStore);
  let body = null;
  let offerPricing = null;

  Promise.all([listingPromise(sdk, bodyParams?.params?.listingId), fetchCommission(sdk)])
    .then(async ([showListingResponse, fetchAssetsResponse]) => {
      const listing = showListingResponse.data.data;
      const commissionAsset = fetchAssetsResponse.data.data[0];

      // Buying and making offers need a verified email (checked on the real order only)
      if (!isSpeculative && requiresVerifiedEmail(transitionName)) {
        await assertEmailVerified(sdk);
      }

      const currency = listing.attributes.price?.currency || orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      // Offers: the customer's offered price or the provider's counter offer (default-purchase),
      // or the provider's offer (default-negotiation)
      offerPricing =
        (await getOfferPricing({
          sdk,
          transitionName,
          orderData,
          listingId: bodyParams?.params?.listingId,
          currency,
        })) || getNegotiationOfferPricing(orderData, transitionName, currency);
      const quantityMaybe = offerPricing?.quantity
        ? { stockReservationQuantity: offerPricing.quantity }
        : {};
      const params = { ...bodyParams.params, ...quantityMaybe };

      // Shipped purchases: the fee depends on the vehicle and the distance between the parties.
      const shippingQuote = needsShippingQuote(transitionName, orderData)
        ? await getShippingQuote({
            sdk,
            listing,
            providerId: listing.relationships?.author?.data?.id,
          })
        : null;

      const lineItems = transactionLineItems(
        listing,
        {
          ...orderData,
          ...params,
          currency,
          // Set last, so that client's params can't override them.
          offer: offerPricing?.offer,
          shippingFee: shippingQuote?.shippingFee,
        },
        providerCommission,
        customerCommission
      );

      // If the client sends expectedPayinTotal (checkout payment flows), ensure it
      assertExpectedPayinTotal(lineItems, orderData?.expectedPayinTotal);

      // Both delivery addresses are saved to the transaction (shipping is organized by Reveevo).
      const protectedDataMaybe = shippingQuote
        ? { protectedData: { ...params.protectedData, delivery: shippingQuote.delivery } }
        : {};
      const metadataMaybe = offerPricing ? { metadata: offerPricing.metadata } : {};

      body = {
        ...bodyParams,
        params: { ...params, ...protectedDataMaybe, lineItems, ...metadataMaybe },
      };
      return getTrustedSdk(req, res, tokenStore);
    })
    .then(async trustedSdk => {
      if (isSpeculative) {
        return trustedSdk.transactions.initiateSpeculative(body, queryParams);
      }
      const response = await trustedSdk.transactions.initiate(body, queryParams);
      // The customer continued from a counter offer: close that earlier offer transaction.
      await closePreviousOfferTransaction(trustedSdk, offerPricing?.transactionToClose);
      return response;
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
