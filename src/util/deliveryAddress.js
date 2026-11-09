import { types as sdkTypes } from './sdkLoader';

const { LatLng } = sdkTypes;

/**
 * Delivery address is saved to user's profile.privateData.deliveryAddress:
 * {
 *   address: 'Liebenwalderstr. 33, 13347 Berlin, Germany', // from address autocomplete
 *   origin: { lat: 52.5497, lng: 13.3553 },               // coordinates of the address
 *   neighborhood: 'Wedding',                              // required (prefilled from autocomplete)
 *   details: 'Apartment 4, 2nd floor',                    // optional extra info
 *   countryCode: 'MX',                                    // from autocomplete (only Mexico)
 *   regionCode: 'MX-CMX',                                 // Mexico City or Estado de México
 *   name: 'Maria Lopez',                                  // from user's profile (not editable)
 *   phoneNumber: '+52 55 1234 5678',                       // required (for the delivery)
 * }
 * Both the seller (ship from) and the buyer (ship to) use the same saved address.
 * Note: keep in sync with server/services/shipping/addresses.js
 */
export const DELIVERY_ADDRESS_KEY = 'deliveryAddress';

// Reveevo delivers only in Mexico, in Mexico City and Estado de México.
// Note: keep in sync with server/services/shipping/addresses.js
export const DELIVERY_COUNTRY_CODE = 'MX';
export const DELIVERY_REGION_CODES = ['MX-CMX', 'MX-MEX'];

/**
 * Checks that the place (from the address autocomplete) is in the delivery area.
 *
 * @param {{ countryCode: string, regionCode: string }} place
 * @returns {boolean}
 */
export const isInDeliveryArea = place =>
  place?.countryCode === DELIVERY_COUNTRY_CODE && DELIVERY_REGION_CODES.includes(place?.regionCode);

// Shipping quote errors from the server (error's statusText).
// Note: keep in sync with SHIPPING_ERROR_CODES in server/services/shipping/index.js
export const SHIPPING_ERROR_CODES = {
  CUSTOMER_ADDRESS_MISSING: 'shipping-customer-address-missing',
  PROVIDER_ADDRESS_MISSING: 'shipping-provider-address-missing',
  OUT_OF_RANGE: 'shipping-out-of-range',
  CURRENCY_NOT_SUPPORTED: 'shipping-currency-not-supported',
};

const isCoordinate = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Checks that the delivery address has the required fields.
 *
 * @param {Object} deliveryAddress
 * @returns {boolean}
 */
export const isCompleteDeliveryAddress = deliveryAddress => {
  const { address, origin, neighborhood, phoneNumber } = deliveryAddress || {};
  return (
    isInDeliveryArea(deliveryAddress) &&
    !!phoneNumber?.trim?.() &&
    !!address?.trim?.() &&
    !!neighborhood?.trim?.() &&
    isCoordinate(origin?.lat) &&
    isCoordinate(origin?.lng)
  );
};

/**
 * Returns the delivery address saved to current user's private data.
 *
 * @param {Object} currentUser
 * @returns {Object|null}
 */
export const getDeliveryAddress = currentUser =>
  currentUser?.attributes?.profile?.privateData?.[DELIVERY_ADDRESS_KEY] || null;

// Full name of the user: deliveries are addressed with it.
const getUserFullName = currentUser => {
  const { firstName = '', lastName = '' } = currentUser?.attributes?.profile || {};
  return `${firstName} ${lastName}`.trim();
};

/**
 * Initial values for DeliveryAddressForm from a saved delivery address.
 * Phone number falls back to the one saved on the contact details page.
 *
 * @param {Object} deliveryAddress
 * @param {Object} [currentUser]
 * @returns {Object} form values: { location, neighborhood, details, phoneNumber }
 */
export const getDeliveryAddressFormValues = (deliveryAddress, currentUser) => {
  const contactPhoneNumber = currentUser?.attributes?.profile?.protectedData?.phoneNumber;
  const { address, origin, neighborhood, details, countryCode, regionCode, phoneNumber } =
    deliveryAddress || {};
  const phoneNumberMaybe =
    phoneNumber || contactPhoneNumber ? { phoneNumber: phoneNumber || contactPhoneNumber } : {};
  const hasPlace = address && typeof origin?.lat === 'number' && typeof origin?.lng === 'number';

  return hasPlace
    ? {
        location: {
          search: address,
          selectedPlace: {
            address,
            origin: new LatLng(origin.lat, origin.lng),
            countryCode,
            regionCode,
          },
        },
        neighborhood,
        details,
        ...phoneNumberMaybe,
      }
    : phoneNumberMaybe;
};

/**
 * Delivery address to save from DeliveryAddressForm values.
 * The name is taken from the user's profile.
 * Note: coordinates are saved as plain numbers (extended data only supports JSON).
 *
 * @param {Object} values form values: { location, neighborhood, details, phoneNumber }
 * @param {Object} currentUser
 * @returns {Object} delivery address
 */
export const getDeliveryAddressFromFormValues = (values, currentUser) => {
  const { location, neighborhood, details, phoneNumber } = values || {};
  const { address, origin, countryCode, regionCode } = location?.selectedPlace || {};
  return {
    address: address?.trim() || '',
    origin: { lat: origin?.lat, lng: origin?.lng },
    neighborhood: neighborhood?.trim() || '',
    details: details?.trim() || '',
    countryCode: countryCode || null,
    regionCode: regionCode || null,
    name: getUserFullName(currentUser),
    phoneNumber: phoneNumber?.trim() || '',
  };
};

////////////////////////////////////////////////////////////////////////////
// Pickup location of a listing                                           //
// The seller's exact address is never public:                            //
// - listing's publicData.location: only the neighborhood                 //
// - listing's geolocation: shifted up to PICKUP_LOCATION_SHIFT_METERS    //
// - listing's privateData.pickupAddress: the full address (seller only)  //
// The full address is copied to the transaction when the seller confirms //
// the order. Note: keep in sync with server/services/shipping/pickupLocations.js
////////////////////////////////////////////////////////////////////////////

export const PICKUP_LOCATION_SHIFT_METERS = 300;
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
 * listing id, so the same listing always gets the same shift (the point doesn't jump around).
 *
 * @param {{ lat: number, lng: number }} origin exact coordinates
 * @param {string} listingId
 * @returns {{ lat: number, lng: number }}
 */
export const getShiftedCoordinates = (origin, listingId) => {
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
 * Listing data for direct pick up from the seller's delivery address.
 *
 * @param {Object} deliveryAddress seller's saved delivery address
 * @param {string} listingId
 * @returns {{ geolocation: LatLng, publicData: Object, privateData: Object }}
 */
export const getListingPickupData = (deliveryAddress, listingId) => {
  const { address, details, origin, neighborhood } = deliveryAddress;
  const shifted = getShiftedCoordinates(origin, listingId);
  return {
    geolocation: new LatLng(shifted.lat, shifted.lng),
    // Note: 'address' is what the template shows for the pickup location (e.g. at checkout)
    publicData: { location: { address: neighborhood, building: '', neighborhood } },
    privateData: { pickupAddress: { address, details: details || '', neighborhood, origin } },
  };
};
