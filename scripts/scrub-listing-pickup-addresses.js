/**
 * Reveevo: one-time cleanup of seller addresses on existing listings.
 *
 * Before, a listing with direct pick up had the seller's exact address in its public data.
 * Now the public data has only the neighborhood and shifted coordinates, and the exact address
 * is in the listing's private data (see server/services/shipping/pickupLocations.js).
 *
 * For each listing with pick up or shipping:
 * - seller has a saved delivery address: write public neighborhood + shifted point (pick up),
 *   and the private exact address
 * - otherwise (pick up only): move the old public address to private data, remove it from
 *   public data and shift the coordinates
 *
 * Usage (dry run by default - nothing is written without --apply):
 *   node scripts/scrub-listing-pickup-addresses.js
 *   node scripts/scrub-listing-pickup-addresses.js --apply
 *
 * Needs SHARETRIBE_INTEGRATION_SDK_CLIENT_ID and SHARETRIBE_INTEGRATION_SDK_CLIENT_SECRET.
 */
require('dotenv').config();

const { types } = require('sharetribe-flex-integration-sdk');
const { getIntegrationSdk } = require('../server/api-util/sdk');
const { isCompleteDeliveryAddress } = require('../server/services/shipping/addresses');
const {
  getListingPickupData,
  getShiftedCoordinates,
} = require('../server/services/shipping/pickupLocations');

const { LatLng } = types;
const PER_PAGE = 100;
const apply = process.argv.includes('--apply');

const fetchAllListings = async (iSdk, page = 1, listings = []) => {
  const response = await iSdk.listings.query({ page, perPage: PER_PAGE, include: ['author'] });
  const all = [...listings, ...response.data.data];
  const totalPages = response.data.meta?.totalPages || 1;
  return page < totalPages ? fetchAllListings(iSdk, page + 1, all) : all;
};

const authorAddressCache = {};
const getAuthorDeliveryAddress = async (iSdk, authorId) => {
  if (!(authorId in authorAddressCache)) {
    const response = await iSdk.users.show({ id: new types.UUID(authorId) });
    authorAddressCache[authorId] =
      response.data.data.attributes.profile.privateData?.deliveryAddress || null;
  }
  return authorAddressCache[authorId];
};

// Listing data without the exact public address, for sellers without a saved address
const getDataFromOldPublicAddress = listing => {
  const { publicData, geolocation } = listing.attributes;
  const { address, building } = publicData?.location || {};
  if (!address || !geolocation) {
    return null;
  }
  const origin = { lat: geolocation.lat, lng: geolocation.lng };
  const shifted = getShiftedCoordinates(origin, listing.id.uuid);
  return {
    geolocation: new LatLng(shifted.lat, shifted.lng),
    publicData: { location: null },
    privateData: { pickupAddress: { address, details: building || '', neighborhood: '', origin } },
  };
};

const main = async () => {
  const iSdk = getIntegrationSdk();
  const listings = await fetchAllListings(iSdk);
  let updated = 0;

  for (const listing of listings) {
    const { publicData, privateData } = listing.attributes;
    const { pickupEnabled, shippingEnabled } = publicData || {};
    if (!pickupEnabled && !shippingEnabled) {
      continue;
    }

    const authorId = listing.relationships?.author?.data?.id?.uuid;
    const deliveryAddress = authorId ? await getAuthorDeliveryAddress(iSdk, authorId) : null;
    const pickupData = isCompleteDeliveryAddress(deliveryAddress)
      ? getListingPickupData(deliveryAddress, listing.id.uuid)
      : pickupEnabled && !privateData?.pickupAddress
      ? getDataFromOldPublicAddress(listing)
      : null;
    if (!pickupData) {
      continue;
    }

    const updateValues = pickupEnabled ? pickupData : { privateData: pickupData.privateData };
    const publicAddressBefore = publicData?.location?.address || '-';
    const publicAddressAfter = pickupEnabled
      ? pickupData.publicData.location?.address || '(removed)'
      : publicAddressBefore;
    console.log(
      `${apply ? 'Updating' : 'Would update'} ${listing.id.uuid}: public address ` +
        `"${publicAddressBefore}" -> "${publicAddressAfter}"`
    );

    if (apply) {
      await iSdk.listings.update({ id: listing.id, ...updateValues });
    }
    updated++;
  }

  console.log(`${apply ? 'Updated' : 'Would update'} ${updated} of ${listings.length} listings.`);
  if (!apply) {
    console.log('Dry run. Run again with --apply to save the changes.');
  }
};

main().catch(e => {
  console.error(e?.data?.errors || e);
  process.exit(1);
});
