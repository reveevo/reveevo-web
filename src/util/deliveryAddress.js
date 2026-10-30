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
 *   name: 'Maria Lopez',                                  // from user's profile (not editable)
 *   phoneNumber: '+52 55 1234 5678',                       // required (for the delivery)
 * }
 * Both the seller (ship from) and the buyer (ship to) use the same saved address.
 * Note: keep in sync with server/services/shipping/addresses.js
 */
export const DELIVERY_ADDRESS_KEY = 'deliveryAddress';

// Reveevo delivers only in Mexico.
export const DELIVERY_COUNTRY_CODE = 'MX';

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
  const { address, origin, neighborhood, countryCode, phoneNumber } = deliveryAddress || {};
  return (
    countryCode === DELIVERY_COUNTRY_CODE &&
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
  const { address, origin, neighborhood, details, countryCode, phoneNumber } =
    deliveryAddress || {};
  const phoneNumberMaybe =
    phoneNumber || contactPhoneNumber ? { phoneNumber: phoneNumber || contactPhoneNumber } : {};
  const hasPlace = address && typeof origin?.lat === 'number' && typeof origin?.lng === 'number';

  return hasPlace
    ? {
        location: {
          search: address,
          selectedPlace: { address, origin: new LatLng(origin.lat, origin.lng), countryCode },
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
  const { address, origin, countryCode } = location?.selectedPlace || {};
  return {
    address: address?.trim() || '',
    origin: { lat: origin?.lat, lng: origin?.lng },
    neighborhood: neighborhood?.trim() || '',
    details: details?.trim() || '',
    countryCode: countryCode || null,
    name: getUserFullName(currentUser),
    phoneNumber: phoneNumber?.trim() || '',
  };
};
