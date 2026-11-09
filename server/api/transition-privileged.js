const sharetribeSdk = require('sharetribe-flex-sdk');
const { assertExpectedPayinTotal } = require('../api-util/assertExpectedPayinTotal');
const { transactionLineItems } = require('../api-util/lineItems');
const {
  addOfferToMetadata,
  getAmountFromPreviousOffer,
  isIntentionToMakeCounterOffer,
  isIntentionToMakeOffer,
  isIntentionToRevokeCounterOffer,
  isIntentionToUpdateOffer,
  throwErrorIfNegotiationOfferHasInvalidHistory,
} = require('../api-util/negotiation');
const {
  createCookieTokenStore,
  getSdk,
  getTrustedSdk,
  handleError,
  serialize,
  fetchCommission,
} = require('../api-util/sdk');
const { getShippingQuote, needsShippingQuote } = require('../services/shipping');
const { assertEmailVerified, requiresVerifiedEmail } = require('../services/users');

const { Money } = sharetribeSdk.types;

const transactionPromise = (sdk, id) =>
  sdk.transactions.show({ id, include: ['listing', 'provider'] });

// default-purchase process: the provider's counter offer only saves the offer to metadata.
// The customer's card hold is released and the customer pays the counter offer in a new
// transaction, so these transitions don't set line items.
const METADATA_ONLY_TRANSITIONS = ['transition/provider-make-counter-offer'];
const getListingRelationShip = transactionShowAPIData => {
  const { data, included } = transactionShowAPIData;
  const { relationships } = data;
  const { listing: listingRef } = relationships;
  return included.find(i => i.id.uuid === listingRef.data.id.uuid);
};

// When a provider is making an offer, make sure that customer related
// protected data is not being saved
const getRoleBasedBodyParams = (orderData, bodyParams) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams?.transition;
  const isProviderOffer =
    isIntentionToMakeOffer(offerInSubunits, transitionName) ||
    isIntentionToUpdateOffer(offerInSubunits, transitionName);

  if (!isProviderOffer) {
    return bodyParams;
  } else {
    const protectedData = bodyParams?.params?.protectedData || {};

    const filteredProtectedData = Object.entries(protectedData).reduce(
      (validEntries, [key, value]) => {
        if (key === 'customerDefaultMessage' || key.startsWith('customer_')) {
          return validEntries;
        } else {
          return { ...validEntries, [key]: value };
        }
      },
      {}
    );

    return {
      ...bodyParams,
      params: {
        ...bodyParams.params,
        protectedData: filteredProtectedData,
      },
    };
  }
};

const getFullOrderData = (orderData, bodyParams, currency, offers) => {
  const { offerInSubunits } = orderData || {};
  const transitionName = bodyParams.transition;

  const roleBasedBodyParams = getRoleBasedBodyParams(orderData, bodyParams);
  const orderDataAndParams = { ...orderData, ...roleBasedBodyParams.params, currency };

  const isNewOffer =
    isIntentionToMakeOffer(offerInSubunits, transitionName) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transitionName) ||
    isIntentionToUpdateOffer(offerInSubunits, transitionName);

  return isNewOffer
    ? {
        ...orderDataAndParams,
        offer: new Money(offerInSubunits, currency),
      }
    : isIntentionToRevokeCounterOffer(transitionName)
    ? {
        ...orderDataAndParams,
        offer: new Money(getAmountFromPreviousOffer(offers), currency),
      }
    : orderDataAndParams;
};

const getUpdatedMetadata = (orderData, transition, existingMetadata) => {
  const { actor, offerInSubunits } = orderData || {};
  // NOTE: for default-negotiation process, the actor is always "provider" when making an offer.
  const hasActor = ['provider', 'customer'].includes(actor);
  const by = hasActor ? actor : null;

  const isNewOffer =
    isIntentionToMakeOffer(offerInSubunits, transition) ||
    isIntentionToMakeCounterOffer(offerInSubunits, transition) ||
    isIntentionToUpdateOffer(offerInSubunits, transition);

  return isNewOffer
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits,
        by,
        transition,
      })
    : isIntentionToRevokeCounterOffer(transition)
    ? addOfferToMetadata(existingMetadata, {
        offerInSubunits: getAmountFromPreviousOffer(existingMetadata.offers),
        by,
        transition,
      })
    : addOfferToMetadata(existingMetadata, null);
};

module.exports = (req, res) => {
  const { isSpeculative, orderData: clientOrderData, bodyParams, queryParams } = req.body || {};
  // The offer price and the shipping fee are only ever set here on the server.
  // Ignore them if the client sends them.
  const { offer, shippingFee, ...orderData } = clientOrderData || {};

  // Share one cookie token store so a refresh during transactions.show is reused for exchangeToken.
  const tokenStore = createCookieTokenStore(req, res);
  const sdk = getSdk(req, res, tokenStore);
  const transitionName = bodyParams.transition;
  let lineItems = null;
  let metadataMaybe = {};
  let deliveryMaybe = {};
  const isMetadataOnly = METADATA_ONLY_TRANSITIONS.includes(transitionName);

  Promise.all([transactionPromise(sdk, bodyParams?.id), fetchCommission(sdk)])
    .then(async responses => {
      const [showTransactionResponse, fetchAssetsResponse] = responses;
      const transaction = showTransactionResponse.data.data;
      const listing = getListingRelationShip(showTransactionResponse.data);
      const commissionAsset = fetchAssetsResponse.data.data[0];

      const existingMetadata = transaction?.attributes?.metadata;
      const existingOffers = existingMetadata?.offers || [];
      const transitions = transaction.attributes.transitions;

      // Check if the transition is related to negotiation offers and if the offers are valid
      throwErrorIfNegotiationOfferHasInvalidHistory(transitionName, existingOffers, transitions);

      const currency =
        transaction.attributes.payinTotal?.currency ||
        listing.attributes.price?.currency ||
        orderData.currency;
      const { providerCommission, customerCommission } =
        commissionAsset?.type === 'jsonAsset' ? commissionAsset.attributes.data : {};

      // Buying needs a verified email (checked on the real order only)
      if (!isSpeculative && requiresVerifiedEmail(transitionName)) {
        await assertEmailVerified(sdk);
      }

      // Shipped purchases: the fee depends on the vehicle and the distance between the parties.
      const shippingQuote = needsShippingQuote(transitionName, orderData)
        ? await getShippingQuote({
            sdk,
            listing,
            providerId: transaction.relationships?.provider?.data?.id,
          })
        : null;
      deliveryMaybe = shippingQuote ? { delivery: shippingQuote.delivery } : {};

      lineItems = isMetadataOnly
        ? null
        : transactionLineItems(
            listing,
            {
              ...getFullOrderData(orderData, bodyParams, currency, existingOffers),
              // Set last, so that client's params can't override it.
              shippingFee: shippingQuote?.shippingFee,
            },
            providerCommission,
            customerCommission
          );

      // If the client sends expectedPayinTotal (checkout payment flows), ensure it
      if (lineItems) {
        assertExpectedPayinTotal(lineItems, orderData?.expectedPayinTotal);
      }

      metadataMaybe = getUpdatedMetadata(orderData, transitionName, existingMetadata);

      return getTrustedSdk(req, res, tokenStore);
    })
    .then(trustedSdk => {
      // Pass role based params to make sure that protectedData only contains protected data
      // for the correct role.
      // - For the default-negotiation process, this removes any customer
      //   related protected data fields if the transition is from a provider
      // - If you customize the transaction process to allow customers to update protected data
      //   after a provider's offer, you can add that logic in this same function.
      const roleBasedBodyParams = getRoleBasedBodyParams(orderData, bodyParams);
      // Omit listingId from params (transition/request-payment-after-inquiry does not need it)
      const { listingId, ...restParams } = roleBasedBodyParams?.params || {};
      // Both delivery addresses are saved to the transaction (shipping is organized by Reveevo).
      const protectedDataMaybe = Object.keys(deliveryMaybe).length
        ? { protectedData: { ...restParams.protectedData, ...deliveryMaybe } }
        : {};
      const lineItemsMaybe = lineItems ? { lineItems } : {};

      // Add lineItems to the body params
      const body = {
        ...bodyParams,
        params: {
          ...restParams,
          ...protectedDataMaybe,
          ...lineItemsMaybe,
          ...metadataMaybe,
        },
      };

      if (isSpeculative) {
        return trustedSdk.transactions.transitionSpeculative(body, queryParams);
      }
      return trustedSdk.transactions.transition(body, queryParams);
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
