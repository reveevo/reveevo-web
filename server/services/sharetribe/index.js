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

module.exports = { getUserDeliveryAddress };
