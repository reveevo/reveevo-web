const { types } = require('sharetribe-flex-sdk');
const { isCompleteDeliveryAddress } = require('./addresses');

const { LatLng } = types;

const LISTINGS_PER_PAGE = 100;

////////////////////////////////////////////////////////////////////////////
// Pickup location of a listing                                           //
// The seller's exact address is never public:                            //
// - listing's publicData.location: only the neighborhood                 //
// - listing's geolocation: shifted up to PICKUP_LOCATION_SHIFT_METERS    //
// - listing's privateData.pickupAddress: the full address (seller only)  //
// Note: keep in sync with the same helpers in src/util/deliveryAddress.js //
////////////////////////////////////////////////////////////////////////////

const PICKUP_LOCATION_SHIFT_METERS = 300;
const EARTH_RADIUS_METERS = 6371000;

// FNV-1a hash of a string as a number in [0, 1)
const hashToUnit = value => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
};

/**
 * Shifts the coordinates by up to PICKUP_LOCATION_SHIFT_METERS. The shift is derived from the
 * listing id, so the same listing always gets the same shift.
 *
 * @param {{ lat: number, lng: number }} origin exact coordinates
 * @param {string} listingId
 * @returns {{ lat: number, lng: number }}
 */
const getShiftedCoordinates = (origin, listingId) => {
  const angle = 2 * Math.PI * hashToUnit(`${listingId}:angle`);
  // sqrt spreads the points evenly over the circle's area
  const distance = PICKUP_LOCATION_SHIFT_METERS * Math.sqrt(hashToUnit(`${listingId}:distance`));
  const latRadians = (origin.lat * Math.PI) / 180;
  const dLat = (distance * Math.cos(angle)) / EARTH_RADIUS_METERS;
  const dLng = (distance * Math.sin(angle)) / (EARTH_RADIUS_METERS * Math.cos(latRadians));
  return {
    lat: origin.lat + (dLat * 180) / Math.PI,
    lng: origin.lng + (dLng * 180) / Math.PI,
  };
};

/**
 * Listing data for direct pick up from the seller's delivery address:
 * public neighborhood and shifted coordinates, private full address.
 *
 * @param {Object} deliveryAddress seller's saved delivery address
 * @param {string} listingId
 * @returns {{ geolocation: LatLng, publicData: Object, privateData: Object }}
 */
const getListingPickupData = (deliveryAddress, listingId) => {
  const { address, details, origin, neighborhood } = deliveryAddress;
  const shifted = getShiftedCoordinates(origin, listingId);
  return {
    geolocation: new LatLng(shifted.lat, shifted.lng),
    publicData: { location: { address: neighborhood, building: '', neighborhood } },
    privateData: { pickupAddress: { address, details: details || '', neighborhood, origin } },
  };
};

const isSamePickupData = (listing, pickupData) => {
  const { publicData, privateData, geolocation } = listing.attributes;
  const pickupAddress = pickupData.privateData.pickupAddress;
  const isSamePublicData =
    !publicData?.pickupEnabled ||
    (publicData?.location?.address === pickupData.publicData.location.address &&
      publicData?.location?.neighborhood === pickupData.publicData.location.neighborhood &&
      geolocation?.lat === pickupData.geolocation.lat &&
      geolocation?.lng === pickupData.geolocation.lng);
  return (
    isSamePublicData &&
    privateData?.pickupAddress?.address === pickupAddress.address &&
    (privateData?.pickupAddress?.details || '') === pickupAddress.details &&
    privateData?.pickupAddress?.origin?.lat === pickupAddress.origin.lat &&
    privateData?.pickupAddress?.origin?.lng === pickupAddress.origin.lng
  );
};

// Fetches all the current user's own listings, page by page.
const fetchAllOwnListings = async (sdk, page = 1, listings = []) => {
  const response = await sdk.ownListings.query({ page, perPage: LISTINGS_PER_PAGE });
  const allListings = [...listings, ...response.data.data];
  const totalPages = response.data.meta?.totalPages || 1;
  return page < totalPages ? fetchAllOwnListings(sdk, page + 1, allListings) : allListings;
};

// Data to update: the private address for listings with pick up or shipping (shipping quotes
// are calculated from it), and the public neighborhood & shifted point for pick up listings.
const getUpdateValues = (listing, pickupData) =>
  listing.attributes.publicData?.pickupEnabled
    ? pickupData
    : { privateData: pickupData.privateData };

/**
 * Updates the pickup data of the current user's listings that have pick up or shipping enabled,
 * so that they match the user's saved delivery address. Call this after the address changes.
 *
 * @param {Object} sdk Marketplace API SDK of the current user (the seller)
 * @returns {Promise<{ updatedListingIds: Array<string> }>}
 */
const syncPickupLocations = async sdk => {
  const currentUserResponse = await sdk.currentUser.show();
  const deliveryAddress =
    currentUserResponse?.data?.data?.attributes?.profile?.privateData?.deliveryAddress;
  if (!isCompleteDeliveryAddress(deliveryAddress)) {
    return { updatedListingIds: [] };
  }

  const listings = await fetchAllOwnListings(sdk);
  const listingsToUpdate = listings
    .filter(l => l.attributes.publicData?.pickupEnabled || l.attributes.publicData?.shippingEnabled)
    .map(l => ({ listing: l, pickupData: getListingPickupData(deliveryAddress, l.id.uuid) }))
    .filter(({ listing, pickupData }) => !isSamePickupData(listing, pickupData));

  // Updated one at a time to stay within the Marketplace API rate limits.
  const updatedListingIds = [];
  for (const { listing, pickupData } of listingsToUpdate) {
    await sdk.ownListings.update({ id: listing.id, ...getUpdateValues(listing, pickupData) });
    updatedListingIds.push(listing.id.uuid);
  }
  return { updatedListingIds };
};

module.exports = { syncPickupLocations, getListingPickupData, getShiftedCoordinates };
