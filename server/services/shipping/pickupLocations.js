const { types } = require('sharetribe-flex-sdk');
const { isCompleteDeliveryAddress } = require('./addresses');

const { LatLng } = types;

const LISTINGS_PER_PAGE = 100;

/**
 * Pickup location of a listing from the seller's delivery address.
 * Note: keep in sync with EditListingDeliveryPanel (it saves the same values).
 *
 * @param {Object} deliveryAddress seller's saved delivery address
 * @returns {{ location: { address, building }, geolocation: LatLng }}
 */
const getPickupLocation = deliveryAddress => {
  const { address, details, origin } = deliveryAddress;
  return {
    location: { address, building: details || '' },
    geolocation: new LatLng(origin.lat, origin.lng),
  };
};

const isSameLocation = (listing, pickupLocation) => {
  const { publicData, geolocation } = listing.attributes;
  const { location } = pickupLocation;
  return (
    publicData?.location?.address === location.address &&
    (publicData?.location?.building || '') === location.building &&
    geolocation?.lat === pickupLocation.geolocation.lat &&
    geolocation?.lng === pickupLocation.geolocation.lng
  );
};

// Fetches all the current user's own listings, page by page.
const fetchAllOwnListings = async (sdk, page = 1, listings = []) => {
  const response = await sdk.ownListings.query({ page, perPage: LISTINGS_PER_PAGE });
  const allListings = [...listings, ...response.data.data];
  const totalPages = response.data.meta?.totalPages || 1;
  return page < totalPages ? fetchAllOwnListings(sdk, page + 1, allListings) : allListings;
};

/**
 * Updates the pickup location of the current user's listings that have direct pick up enabled,
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

  const pickupLocation = getPickupLocation(deliveryAddress);
  const listings = await fetchAllOwnListings(sdk);
  const listingsToUpdate = listings.filter(
    l => l.attributes.publicData?.pickupEnabled && !isSameLocation(l, pickupLocation)
  );

  // Updated one at a time to stay within the Marketplace API rate limits.
  const updatedListingIds = [];
  for (const listing of listingsToUpdate) {
    await sdk.ownListings.update({
      id: listing.id,
      geolocation: pickupLocation.geolocation,
      publicData: { location: pickupLocation.location },
    });
    updatedListingIds.push(listing.id.uuid);
  }
  return { updatedListingIds };
};

module.exports = { syncPickupLocations };
