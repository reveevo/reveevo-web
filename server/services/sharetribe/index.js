const { types } = require('sharetribe-flex-integration-sdk');
const { getIntegrationSdk } = require('../../api-util/sdk');

const { UUID } = types;

// Integration SDK only serializes its own UUID type. Ids from the Marketplace API SDK
// (another UUID class) or plain strings are converted to it.
const toIntegrationUUID = id => new UUID(typeof id === 'string' ? id : id?.uuid);

/**
 * Returns the delivery address saved to the user's profile.privateData.
 * Users can't read each other's private data, so this uses the Integration API.
 *
 * @param {Object|string} userId - The Sharetribe user id (UUID object or string)
 * @returns {Promise<Object|null>} the saved delivery address
 */
const getUserDeliveryAddress = async userId => {
  const response = await getIntegrationSdk().users.show({ id: toIntegrationUUID(userId) });
  return response?.data?.data?.attributes?.profile?.privateData?.deliveryAddress || null;
};

/**
 * Returns the exact pickup address saved to the listing's privateData (only the author can see
 * it, so this uses the Integration API). The public data has only the neighborhood.
 *
 * @param {Object|string} listingId - The listing id (UUID object or string)
 * @returns {Promise<Object|null>} { address, details, neighborhood, origin }
 */
const getListingPickupAddress = async listingId => {
  const response = await getIntegrationSdk().listings.show({ id: toIntegrationUUID(listingId) });
  return response?.data?.data?.attributes?.privateData?.pickupAddress || null;
};

module.exports = { getUserDeliveryAddress, getListingPickupAddress };
