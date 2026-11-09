const { types } = require('sharetribe-flex-sdk');
const {
  syncPickupLocations,
  getListingPickupData,
  getShiftedCoordinates,
} = require('./pickupLocations');

const { UUID } = types;

const deliveryAddress = {
  address: 'Calle Londres 247, Del Carmen, Coyoacán',
  origin: { lat: 19.355, lng: -99.162 },
  neighborhood: 'Del Carmen',
  details: 'Casa azul',
  countryCode: 'MX',
  phoneNumber: '+52 55 1234 5678',
};

// Distance in meters between two points (equirectangular approximation, fine for short distances)
const distanceMeters = (a, b) => {
  const x = ((b.lng - a.lng) * Math.PI * Math.cos(((a.lat + b.lat) * Math.PI) / 360)) / 180;
  const y = ((b.lat - a.lat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371000;
};

const listing = (id, publicData, extra = {}) => ({
  id: new UUID(id),
  attributes: { publicData, geolocation: null, privateData: {}, ...extra },
});

const createSdk = ({ address, pages }) => ({
  currentUser: {
    show: jest.fn().mockResolvedValue({
      data: { data: { attributes: { profile: { privateData: { deliveryAddress: address } } } } },
    }),
  },
  ownListings: {
    query: jest.fn(({ page }) =>
      Promise.resolve({ data: { data: pages[page - 1], meta: { totalPages: pages.length } } })
    ),
    update: jest.fn().mockResolvedValue({}),
  },
});

describe('pickup location', () => {
  it('shifts the coordinates by at most 300 m, always the same way per listing', () => {
    const shifted = getShiftedCoordinates(deliveryAddress.origin, 'listing-1');
    expect(distanceMeters(deliveryAddress.origin, shifted)).toBeLessThanOrEqual(300);
    expect(getShiftedCoordinates(deliveryAddress.origin, 'listing-1')).toEqual(shifted);
    expect(getShiftedCoordinates(deliveryAddress.origin, 'listing-2')).not.toEqual(shifted);
  });

  it('keeps the exact address private and only the neighborhood public', () => {
    const data = getListingPickupData(deliveryAddress, 'listing-1');
    expect(data.publicData.location).toEqual({
      address: 'Del Carmen',
      building: '',
      neighborhood: 'Del Carmen',
    });
    expect(JSON.stringify(data.publicData)).not.toContain('Londres');
    expect(data.privateData.pickupAddress.address).toBe(deliveryAddress.address);
    expect(data.privateData.pickupAddress.origin).toEqual(deliveryAddress.origin);
  });
});

describe('syncPickupLocations', () => {
  it('updates pick up and shipping listings that are out of date (on all pages)', async () => {
    const pickupData = getListingPickupData(deliveryAddress, 'up-to-date');
    const upToDate = listing(
      'up-to-date',
      { pickupEnabled: true, ...pickupData.publicData },
      { geolocation: pickupData.geolocation, privateData: pickupData.privateData }
    );
    const outdatedPickup = listing('outdated-pickup', {
      pickupEnabled: true,
      location: { address: 'Calle Londres 247', building: '' },
    });
    const shippingOnly = listing('shipping-only', { pickupEnabled: false, shippingEnabled: true });
    const noDelivery = listing('no-delivery', { pickupEnabled: false, shippingEnabled: false });
    const sdk = createSdk({
      address: deliveryAddress,
      pages: [[upToDate, shippingOnly, noDelivery], [outdatedPickup]],
    });

    const result = await syncPickupLocations(sdk);

    expect(result.updatedListingIds).toEqual(['shipping-only', 'outdated-pickup']);
    expect(sdk.ownListings.query).toHaveBeenCalledTimes(2);
    // Shipping only: just the private address
    expect(sdk.ownListings.update).toHaveBeenCalledWith({
      id: shippingOnly.id,
      privateData: getListingPickupData(deliveryAddress, 'shipping-only').privateData,
    });
    // Pick up: public neighborhood and shifted point too
    expect(sdk.ownListings.update).toHaveBeenCalledWith({
      id: outdatedPickup.id,
      ...getListingPickupData(deliveryAddress, 'outdated-pickup'),
    });
  });

  it('does nothing if the user has no complete address', async () => {
    const sdk = createSdk({ address: null, pages: [[]] });
    const result = await syncPickupLocations(sdk);
    expect(result.updatedListingIds).toEqual([]);
    expect(sdk.ownListings.query).not.toHaveBeenCalled();
  });
});
