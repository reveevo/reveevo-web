const { types } = require('sharetribe-flex-sdk');
const { getDrivingDistanceKm } = require('../mapbox');
const { getListingPickupAddress, getUserDeliveryAddress } = require('../sharetribe');
const { isCompleteDeliveryAddress, pickDeliveryAddress } = require('./addresses');
const { getPeopleNeeded, getShippingFeeInMXN, MAX_DISTANCE_KM } = require('./rates');
const { getVehicleForListing } = require('./vehicles');
const { syncPickupLocations } = require('./pickupLocations');

const { Money } = types;

// Error codes are sent to the client as the error's statusText.
// Note: keep in sync with SHIPPING_ERROR_CODES in src/util/deliveryAddress.js
const SHIPPING_ERROR_CODES = {
  CUSTOMER_ADDRESS_MISSING: 'shipping-customer-address-missing',
  PROVIDER_ADDRESS_MISSING: 'shipping-provider-address-missing',
  OUT_OF_RANGE: 'shipping-out-of-range',
  CURRENCY_NOT_SUPPORTED: 'shipping-currency-not-supported',
};

// The fee table is in Mexican pesos.
const SHIPPING_CURRENCY = 'MXN';

const createShippingError = (code, data = {}) => {
  const error = new Error(code);
  error.status = 400;
  error.statusText = code;
  error.data = { code, ...data };
  return error;
};

// default-purchase process: transitions where the customer pays for the order
// (offers hold the customer's card too, so the shipping fee is included in the offer)
const PAYMENT_TRANSITIONS = [
  'transition/request-payment',
  'transition/request-payment-after-inquiry',
  'transition/request-payment-for-counter-offer',
  'transition/customer-make-offer',
];

/**
 * Checks if the transition needs a shipping quote: the customer pays for a shipped order.
 *
 * @param {string} transitionName
 * @param {Object} orderData
 * @returns {boolean}
 */
const needsShippingQuote = (transitionName, orderData) =>
  PAYMENT_TRANSITIONS.includes(transitionName) && orderData?.deliveryMethod === 'shipping';

/**
 * Calculates the shipping fee for delivering the listing from the provider to the current user.
 *
 * - Vehicle: from the listing's subcategory (and size/amount fields)
 * - Distance: driving distance between the provider's and the customer's saved delivery addresses
 * - Fee: from the Reveevo fee table (vehicle × distance band)
 *
 * @param {Object} params
 * @param {Object} params.sdk Marketplace API SDK of the current user (the customer)
 * @param {Object} params.listing listing entity (with attributes.publicData and price)
 * @param {Object} params.providerId the listing author's id
 * @returns {Promise<{ shippingFee: Money, delivery: Object }>}
 *   delivery is saved to transaction's protectedData:
 *   { from, to, distanceKm, vehicle, peopleNeeded }
 */
const getShippingQuote = async ({ sdk, listing, providerId }) => {
  const currency = listing?.attributes?.price?.currency;
  if (currency !== SHIPPING_CURRENCY) {
    throw createShippingError(SHIPPING_ERROR_CODES.CURRENCY_NOT_SUPPORTED, { currency });
  }

  // The item is collected from the listing's exact pickup address (listing's private data).
  // Contact details (name, phone) come from the provider's saved address, which is also the
  // fallback for listings that don't have the private pickup address yet.
  const [currentUserResponse, providerProfileAddress, listingPickupAddress] = await Promise.all([
    sdk.currentUser.show(),
    getUserDeliveryAddress(providerId),
    getListingPickupAddress(listing.id),
  ]);
  const hasListingOrigin =
    typeof listingPickupAddress?.origin?.lat === 'number' &&
    typeof listingPickupAddress?.origin?.lng === 'number';
  const providerAddress = hasListingOrigin
    ? { ...providerProfileAddress, ...listingPickupAddress }
    : providerProfileAddress;
  const customerAddress =
    currentUserResponse?.data?.data?.attributes?.profile?.privateData?.deliveryAddress;

  if (!isCompleteDeliveryAddress(customerAddress)) {
    throw createShippingError(SHIPPING_ERROR_CODES.CUSTOMER_ADDRESS_MISSING);
  }
  if (!isCompleteDeliveryAddress(providerAddress)) {
    throw createShippingError(SHIPPING_ERROR_CODES.PROVIDER_ADDRESS_MISSING);
  }

  const from = pickDeliveryAddress(providerAddress);
  const to = pickDeliveryAddress(customerAddress);
  const distanceKmRaw = await getDrivingDistanceKm({ from: from.origin, to: to.origin, sdk });
  if (distanceKmRaw == null || distanceKmRaw > MAX_DISTANCE_KM) {
    throw createShippingError(SHIPPING_ERROR_CODES.OUT_OF_RANGE, {
      maxDistanceKm: MAX_DISTANCE_KM,
    });
  }
  const distanceKm = Math.round(distanceKmRaw * 10) / 10;

  const { vehicle } = getVehicleForListing(listing.attributes.publicData);
  const feeInMXN = getShippingFeeInMXN(vehicle, distanceKm);
  if (feeInMXN == null) {
    throw createShippingError(SHIPPING_ERROR_CODES.OUT_OF_RANGE, {
      maxDistanceKm: MAX_DISTANCE_KM,
    });
  }

  return {
    shippingFee: new Money(Math.round(feeInMXN * 100), currency),
    delivery: { from, to, distanceKm, vehicle, peopleNeeded: getPeopleNeeded(vehicle) },
  };
};

module.exports = {
  SHIPPING_ERROR_CODES,
  needsShippingQuote,
  getShippingQuote,
  syncPickupLocations,
};
