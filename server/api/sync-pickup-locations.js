const { getSdk, handleError } = require('../api-util/sdk');
const { syncPickupLocations } = require('../services/shipping');

/**
 * Updates the pickup location of the current user's listings (with direct pick up enabled)
 * to match their saved delivery address. The client calls this after the address is saved.
 *
 * Response: { data: { updatedListingIds: [...] } }
 */
module.exports = async (req, res) => {
  try {
    const result = await syncPickupLocations(getSdk(req, res));
    res.status(200).json({ data: result });
  } catch (e) {
    handleError(res, e);
  }
};
