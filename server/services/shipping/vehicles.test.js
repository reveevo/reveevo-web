const { getVehicleForListing } = require('./vehicles');
const { VEHICLES } = require('./rates');

// Subcategory ids in the hosted listing-categories config (Console), 11 Nov 2026
const CONSOLE_SUBCATEGORY_IDS = [
  'Armchair',
  'Art',
  'Bench',
  'Bookshelf',
  'DYI-tools',
  'Entryway',
  'Hammock',
  'Outdoor-planters',
  'Serving',
  'Sport',
  'Sports-kids',
  'TV-console',
  'Tableware',
  'Vanity',
  'accessories-bathroom',
  'bar-cart',
  'bar-stool',
  'bassinet',
  'bed',
  'bed-kids',
  'bedside',
  'blanket',
  'books',
  'boxes-storage',
  'cabinet-bathroom',
  'cabinet-dining',
  'camping',
  'candles',
  'carpet',
  'chair-dining',
  'chair-office',
  'closet',
  'coffee-table',
  'cookware',
  'couch',
  'crib',
  'curtains',
  'cutlery',
  'decor-other',
  'desk',
  'desk-kids',
  'dining-table',
  'dresser',
  'frames',
  'glasses',
  'hangers',
  'high-chair-baby',
  'laundry',
  'lighting-flooe',
  'lighting-table',
  'mattress',
  'mirro',
  'music-equipment',
  'nursing-chair',
  'office-supplies',
  'organizer',
  'outdoor-dining',
  'outdoor-loung',
  'parasol',
  'pillows',
  'playroom',
  'side-table-living',
  'storage-cabinets',
  'storage-kitchen',
  'stroller',
  'sun-lounger',
  'table-linens',
  'toys',
  'trashbin-bathroom',
  'trashbin-kitch',
  'utensils-kitchen',
  'vases',
  'workout',
];

const vehicleFor = publicData => getVehicleForListing(publicData).vehicle;

describe('category → vehicle mapping', () => {
  it('has a vehicle for every subcategory in Console', () => {
    const unmapped = CONSOLE_SUBCATEGORY_IDS.filter(
      id => getVehicleForListing({ categoryLevel2: id }).isDefault
    );
    expect(unmapped).toEqual([]);
  });

  it('uses the revised mapping', () => {
    expect(vehicleFor({ categoryLevel2: 'dining-table', table_size: 'small-2-people' })).toBe(
      VEHICLES.PICKUP
    );
    expect(vehicleFor({ categoryLevel2: 'outdoor-dining', table_size: 'small-2-people' })).toBe(
      VEHICLES.PICKUP
    );
    expect(vehicleFor({ categoryLevel2: 'outdoor-dining', table_size: 'large-8-people' })).toBe(
      VEHICLES.TRUCK
    );
    expect(vehicleFor({ categoryLevel2: 'carpet', carpet_size: 'medium' })).toBe(VEHICLES.PICKUP);
    expect(vehicleFor({ categoryLevel2: 'lighting-table' })).toBe(VEHICLES.SEDAN);
    expect(vehicleFor({ categoryLevel2: 'lighting-flooe' })).toBe(VEHICLES.UV);
    expect(vehicleFor({ categoryLevel2: 'mirro' })).toBe(VEHICLES.SUV);
    expect(vehicleFor({ categoryLevel2: 'workout' })).toBe(VEHICLES.HATCHBACK);
  });

  it('uses the biggest vehicle when the variant is missing', () => {
    expect(vehicleFor({ categoryLevel2: 'carpet' })).toBe(VEHICLES.UV);
    expect(vehicleFor({ categoryLevel2: 'outdoor-dining' })).toBe(VEHICLES.TRUCK);
  });
});
