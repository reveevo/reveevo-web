/**
 * Delivery address saved to user's profile.privateData.deliveryAddress:
 * {
 *   address: 'Liebenwalderstr. 33, 13347 Berlin, Germany', // from address autocomplete
 *   origin: { lat: 52.5497, lng: 13.3553 },               // coordinates of the address
 *   neighborhood: 'Wedding',                              // required (prefilled from autocomplete)
 *   details: 'Apartment 4, 2nd floor',                    // optional extra info
 *   countryCode: 'MX',                                    // from autocomplete (only Mexico)
 *   name: 'Maria Lopez',                                  // from user's profile
 *   phoneNumber: '+52 55 1234 5678',                       // required (for the delivery)
 * }
 * Note: keep in sync with src/util/deliveryAddress.js
 */

// Reveevo delivers only in Mexico.
const DELIVERY_COUNTRY_CODE = 'MX';

const toTrimmedString = value => (typeof value === 'string' ? value.trim() : '');
const isCoordinate = value => typeof value === 'number' && Number.isFinite(value);

/**
 * Picks the known delivery address fields.
 *
 * @param {Object} deliveryAddress
 * @returns {Object} { address, origin, neighborhood, details }
 */
const pickDeliveryAddress = deliveryAddress => {
  const { address, origin, neighborhood, details, countryCode, name, phoneNumber } =
    deliveryAddress || {};
  return {
    address: toTrimmedString(address),
    origin: { lat: origin?.lat, lng: origin?.lng },
    neighborhood: toTrimmedString(neighborhood),
    details: toTrimmedString(details),
    countryCode: toTrimmedString(countryCode),
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
  const { address, origin, neighborhood, countryCode, phoneNumber } = deliveryAddress || {};
  return (
    countryCode === DELIVERY_COUNTRY_CODE &&
    !!toTrimmedString(phoneNumber) &&
    !!toTrimmedString(address) &&
    !!toTrimmedString(neighborhood) &&
    isCoordinate(origin?.lat) &&
    isCoordinate(origin?.lng)
  );
};

module.exports = { pickDeliveryAddress, isCompleteDeliveryAddress };
