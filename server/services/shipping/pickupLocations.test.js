const { types } = require('sharetribe-flex-sdk');
const { syncPickupLocations } = require('./pickupLocations');

const { LatLng, UUID } = types;

const deliveryAddress = {
  address: 'Calle Londres 247, Del Carmen, Coyoacán',
  origin: { lat: 19.355, lng: -99.162 },
  neighborhood: 'Del Carmen',
  details: 'Casa azul',
  countryCode: 'MX',
  phoneNumber: '+52 55 1234 5678',
};

const listing = (id, publicData, geolocation = null) => ({
  id: new UUID(id),
  attributes: { publicData, geolocation },
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

describe('syncPickupLocations', () => {
  it('updates the pickup listings that have an old location (on all pages)', async () => {
    const upToDate = listing(
      'up-to-date',
      {
        pickupEnabled: true,
        location: { address: deliveryAddress.address, building: 'Casa azul' },
      },
      new LatLng(19.355, -99.162)
    );
    const outdated = listing('outdated', {
      pickupEnabled: true,
      location: { address: 'Old address', building: '' },
    });
    const shippingOnly = listing('shipping-only', { pickupEnabled: false, shippingEnabled: true });
    const sdk = createSdk({
      address: deliveryAddress,
      pages: [[upToDate, shippingOnly], [outdated]],
    });

    const result = await syncPickupLocations(sdk);

    expect(result.updatedListingIds).toEqual(['outdated']);
    expect(sdk.ownListings.query).toHaveBeenCalledTimes(2);
    expect(sdk.ownListings.update).toHaveBeenCalledWith({
      id: outdated.id,
      geolocation: new LatLng(19.355, -99.162),
      publicData: { location: { address: deliveryAddress.address, building: 'Casa azul' } },
    });
  });

  it('does nothing if the user has no complete address', async () => {
    const sdk = createSdk({ address: null, pages: [[]] });
    const result = await syncPickupLocations(sdk);
    expect(result.updatedListingIds).toEqual([]);
    expect(sdk.ownListings.query).not.toHaveBeenCalled();
  });
});
