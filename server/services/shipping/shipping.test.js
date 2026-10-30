const { types } = require('sharetribe-flex-sdk');
const { getShippingFeeInMXN, getPeopleNeeded, VEHICLES } = require('./rates');
const { getVehicleForListing, DEFAULT_VEHICLE } = require('./vehicles');
const { isCompleteDeliveryAddress } = require('./addresses');

jest.mock('../mapbox', () => ({ getDrivingDistanceKm: jest.fn() }));
jest.mock('../sharetribe', () => ({ getUserDeliveryAddress: jest.fn() }));

const { getDrivingDistanceKm } = require('../mapbox');
const { getUserDeliveryAddress } = require('../sharetribe');
const { getShippingQuote, needsShippingQuote, SHIPPING_ERROR_CODES } = require('./index');

const { Money } = types;

const address = (lat, lng, neighborhood = 'Roma Norte') => ({
  address: 'Calle Colima 123, Roma Norte, Ciudad de México',
  origin: { lat, lng },
  neighborhood,
  details: '',
  countryCode: 'MX',
  phoneNumber: '+52 55 1234 5678',
});

describe('shipping rates', () => {
  it('picks the fee from the distance band', () => {
    expect(getShippingFeeInMXN(VEHICLES.VAN, 3)).toBe(885);
    expect(getShippingFeeInMXN(VEHICLES.VAN, 5)).toBe(885);
    expect(getShippingFeeInMXN(VEHICLES.VAN, 5.1)).toBe(1060);
    expect(getShippingFeeInMXN(VEHICLES.TRUCK, 50)).toBe(3250);
  });

  it('returns null over the served distance', () => {
    expect(getShippingFeeInMXN(VEHICLES.SUV, 50.1)).toBeNull();
  });

  it('uses the hatchback rate for motorcycles over 20 km', () => {
    expect(getShippingFeeInMXN(VEHICLES.MOTORCYCLE, 20)).toBe(155);
    expect(getShippingFeeInMXN(VEHICLES.MOTORCYCLE, 25)).toBe(315);
  });

  it('books two people for the big vehicles', () => {
    expect(getPeopleNeeded(VEHICLES.UV)).toBe(2);
    expect(getPeopleNeeded(VEHICLES.SUV)).toBe(1);
  });
});

describe('vehicle mapping', () => {
  it('maps a subcategory to a vehicle', () => {
    expect(getVehicleForListing({ categoryLevel2: 'cutlery' }).vehicle).toBe(VEHICLES.MOTORCYCLE);
  });

  it('uses the variant field when the subcategory depends on it', () => {
    expect(getVehicleForListing({ categoryLevel2: 'couch', couch_type: '2-seater' }).vehicle).toBe(
      VEHICLES.UV
    );
    expect(getVehicleForListing({ categoryLevel2: 'bed', bed_size: 'King' }).vehicle).toBe(
      VEHICLES.TRUCK
    );
  });

  it('uses the biggest vehicle of the subcategory when the variant is missing', () => {
    expect(getVehicleForListing({ categoryLevel2: 'chair-dining' }).vehicle).toBe(VEHICLES.PICKUP);
  });

  it('uses the default vehicle for unknown subcategories', () => {
    expect(getVehicleForListing({ categoryLevel2: 'unknown' })).toEqual({
      vehicle: DEFAULT_VEHICLE,
      isDefault: true,
    });
  });
});

describe('delivery address', () => {
  it('requires address, neighborhood and coordinates', () => {
    expect(isCompleteDeliveryAddress(address(19.4, -99.1))).toBe(true);
    expect(isCompleteDeliveryAddress({ ...address(19.4, -99.1), neighborhood: ' ' })).toBe(false);
    expect(isCompleteDeliveryAddress({ ...address(19.4, -99.1), origin: {} })).toBe(false);
    expect(isCompleteDeliveryAddress({ ...address(52.5, 13.3), countryCode: 'DE' })).toBe(false);
    expect(isCompleteDeliveryAddress(null)).toBe(false);
  });
});

describe('getShippingQuote', () => {
  const listing = {
    attributes: {
      price: new Money(100000, 'MXN'),
      publicData: { categoryLevel2: 'couch', couch_type: '3-seater' },
    },
  };
  const sdkWithCustomerAddress = customerAddress => ({
    currentUser: {
      show: jest.fn().mockResolvedValue({
        data: {
          data: { attributes: { profile: { privateData: { deliveryAddress: customerAddress } } } },
        },
      }),
    },
  });

  beforeEach(() => {
    getDrivingDistanceKm.mockReset();
    getUserDeliveryAddress.mockReset();
  });

  it('needs a quote only when a shipped order is paid', () => {
    expect(needsShippingQuote('transition/request-payment', { deliveryMethod: 'shipping' })).toBe(
      true
    );
    expect(needsShippingQuote('transition/request-payment', { deliveryMethod: 'pickup' })).toBe(
      false
    );
    expect(
      needsShippingQuote('transition/customer-make-offer', { deliveryMethod: 'shipping' })
    ).toBe(false);
  });

  it('calculates the fee from the vehicle and the driving distance', async () => {
    getUserDeliveryAddress.mockResolvedValue(address(19.42, -99.16, 'Condesa'));
    getDrivingDistanceKm.mockResolvedValue(12.34);
    const sdk = sdkWithCustomerAddress(address(19.43, -99.13));

    const quote = await getShippingQuote({ sdk, listing, providerId: 'provider-id' });

    expect(quote.shippingFee).toEqual(new Money(197000, 'MXN')); // Truck, 10–15 km
    expect(quote.delivery).toMatchObject({
      distanceKm: 12.3,
      vehicle: VEHICLES.TRUCK,
      peopleNeeded: 2,
      from: { neighborhood: 'Condesa' },
      to: { neighborhood: 'Roma Norte' },
    });
  });

  it('fails if the customer has no address', async () => {
    getUserDeliveryAddress.mockResolvedValue(address(19.42, -99.16));
    await expect(
      getShippingQuote({ sdk: sdkWithCustomerAddress(null), listing, providerId: 'p' })
    ).rejects.toMatchObject({ statusText: SHIPPING_ERROR_CODES.CUSTOMER_ADDRESS_MISSING });
  });

  it('fails if the provider has no address', async () => {
    getUserDeliveryAddress.mockResolvedValue(null);
    await expect(
      getShippingQuote({
        sdk: sdkWithCustomerAddress(address(19.4, -99.1)),
        listing,
        providerId: 'p',
      })
    ).rejects.toMatchObject({ statusText: SHIPPING_ERROR_CODES.PROVIDER_ADDRESS_MISSING });
  });

  it('fails if the distance is over the served area', async () => {
    getUserDeliveryAddress.mockResolvedValue(address(19.42, -99.16));
    getDrivingDistanceKm.mockResolvedValue(64);
    await expect(
      getShippingQuote({
        sdk: sdkWithCustomerAddress(address(19.4, -99.1)),
        listing,
        providerId: 'p',
      })
    ).rejects.toMatchObject({ statusText: SHIPPING_ERROR_CODES.OUT_OF_RANGE });
  });
});
