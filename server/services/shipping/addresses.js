/**
 * Delivery address saved to user's profile.privateData.deliveryAddress:
 * {
 *   address: 'Liebenwalderstr. 33, 13347 Berlin, Germany', // from address autocomplete
 *   origin: { lat: 52.5497, lng: 13.3553 },               // coordinates of the address
 *   neighborhood: 'Wedding',                              // required (prefilled from autocomplete)
 *   details: 'Apartment 4, 2nd floor',                    // optional extra info
 *   countryCode: 'MX',                                    // from autocomplete (only Mexico)
 *   regionCode: 'MX-CMX',                                 // Mexico City or Estado de México
 *   name: 'Maria Lopez',                                  // from user's profile
 *   phoneNumber: '+52 55 1234 5678',                       // required (for the delivery)
 * }
 * Note: keep in sync with src/util/deliveryAddress.js
 */

// Reveevo delivers only in Mexico, in Mexico City and Estado de México.
const DELIVERY_COUNTRY_CODE = 'MX';
const DELIVERY_REGION_CODES = ['MX-CMX', 'MX-MEX'];

const toTrimmedString = value => (typeof value === 'string' ? value.trim() : '');
const isCoordinate = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Picks the known delivery address fields.
 *
 * @param {Object} deliveryAddress
 * @returns {Object} { address, origin, neighborhood, details }
 */
const pickDeliveryAddress = deliveryAddress => {
  const { address, origin, neighborhood, details, countryCode, regionCode, name, phoneNumber } =
    deliveryAddress || {};
  return {
    address: toTrimmedString(address),
    origin: { lat: origin?.lat, lng: origin?.lng },
    neighborhood: toTrimmedString(neighborhood),
    details: toTrimmedString(details),
    countryCode: toTrimmedString(countryCode),
    regionCode: toTrimmedString(regionCode),
    name: toTrimmedString(name),
    phoneNumber: toTrimmedString(phoneNumber),
  };
};

/**
 * Checks that the delivery address has the required fields.
 *
 * @param {Object} deliveryAddress
 * @returns {boolean}
 */
const isCompleteDeliveryAddress = deliveryAddress => {
  const { address, origin, neighborhood, countryCode, regionCode, phoneNumber } =
    deliveryAddress || {};
  return (
    countryCode === DELIVERY_COUNTRY_CODE &&
    DELIVERY_REGION_CODES.includes(regionCode) &&
    !!toTrimmedString(phoneNumber) &&
    !!toTrimmedString(address) &&
    !!toTrimmedString(neighborhood) &&
    isCoordinate(origin?.lat) &&
    isCoordinate(origin?.lng)
  );
};

module.exports = { pickDeliveryAddress, isCompleteDeliveryAddress };
