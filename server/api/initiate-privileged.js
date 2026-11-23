const sharetribeSdk = require('sharetribe-flex-sdk');
const { assertExpectedPayinTotal } = require('../api-util/assertExpectedPayinTotal');
const { transactionLineItems } = require('../api-util/lineItems');
const { isIntentionToMakeOffer, pickOfferOrderData } = require('../api-util/negotiation');
const { getShippingQuote, needsShippingQuote } = require('../services/shipping');
const { assertEmailVerified, requiresVerifiedEmail } = require('../services/users');
const {
  getCheckoutPromoCode,
  getPromoCodeProtectedData,
  withPromoCodeUse,
} = require('../services/promoCodes');
const {
  createCookieTokenStore,
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');
const { sanitizePushPaymentBodyParams } = require('../api-util/pushPaymentMethodValidation');

const { Money } = sharetribeSdk.types;

const listingPromise = (sdk, id) => sdk.listings.show({ id, include: ['author'] });

// default-purchase process: the customer makes an offer on a product listing
const isPurchaseOffer = transitionName => transitionName === 'transition/customer-make-offer';

const getFullOrderData = (clientOrderData, bodyParams, currency) => {
  // The offer price, the shipping fee and the promo code's discount are only ever set here on
  // the server. Ignore them if the client sends them.
  const { offer, shippingFee, promoCode, ...orderData } = clientOrderData || {};
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
  const { isSpeculative, orderData, bodyParams: incomingBodyParams, queryParams } = req.body || {};
  let bodyParams;
  try {
    // Push payments (redirect): an example how to validate push payment method types. Unused by default.
    bodyParams = sanitizePushPaymentBodyParams(incomingBodyParams);
  } catch (e) {
    return handleError(res, e, { skipErrorLogging: true });
  }
  const transitionName = bodyParams.transition;
  // Share one cookie token store so a refresh during listings.show is reused for exchangeToken.
  const tokenStore = createCookieTokenStore(req, res);
  const sdk = getSdk(req, res, tokenStore);
  let lineItems = null;
  let metadataMaybe = {};
  let deliveryMaybe = {};
  let promoCode = null;

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

      // Shipped purchases: the fee depends on the vehicle and the distance between the parties.
      const shippingQuote = needsShippingQuote(transitionName, orderData)
        ? await getShippingQuote({
            sdk,
            listing,
            providerId: listing.relationships?.author?.data?.id,
          })
        : null;
      deliveryMaybe = shippingQuote ? { delivery: shippingQuote.delivery } : {};

      // The promo code entered at checkout (if any), created by Reveevo's admins
      promoCode = await getCheckoutPromoCode({ code: orderData?.promoCode, transitionName });

      lineItems = transactionLineItems(
        listing,
        {
          ...getFullOrderData(orderData, bodyParams, currency),
          // Shipping fee is set last, so that client's params can't override it.
          shippingFee: shippingQuote?.shippingFee,
        },
        providerCommission,
        customerCommission,
        { promoCode }
      );

      // If the client sends expectedPayinTotal (checkout payment flows), ensure it
      assertExpectedPayinTotal(lineItems, orderData?.expectedPayinTotal);

      metadataMaybe = getMetadata(orderData, transitionName);

      return getTrustedSdk(req, res, tokenStore);
    })
    .then(trustedSdk => {
      const { params } = bodyParams;
      // Both delivery addresses are saved to the transaction, so that both parties see them,
      // and the applied promo code (if any).
      const serverProtectedData = {
        ...deliveryMaybe,
        ...getPromoCodeProtectedData(promoCode, lineItems),
      };
      const protectedDataMaybe = Object.keys(serverProtectedData).length
        ? { protectedData: { ...params?.protectedData, ...serverProtectedData } }
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
      // A use of the promo code is counted only when the order is placed
      return withPromoCodeUse(
        {
          promoCode,
          lineItems,
          isSpeculative,
          details: { listingId: params?.listingId?.uuid || null },
        },
        () => trustedSdk.transactions.initiate(body, queryParams)
      );
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
