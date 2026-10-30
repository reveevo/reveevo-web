const { VEHICLES } = require('./rates');

const { MOTORCYCLE, HATCHBACK, SEDAN, SUV, PICKUP, UV, VAN, TRUCK } = VEHICLES;

/**
 * Category → vehicle mapping.
 * Source: "Shipping fees and mapping" spreadsheet, sheet "Category Mapping".
 *
 * Keyed by the subcategory id (listing's publicData.categoryLevel2) from the hosted
 * listing-categories config. Some subcategories depend on a listing field (the "variant"):
 * { field, options: { [option]: vehicle }, fallback }. The fallback is used when the variant is
 * missing or unknown, and it's the biggest vehicle of that subcategory (the spreadsheet's rule).
 */
const SUBCATEGORY_VEHICLES = {
  // Bedroom
  bed: {
    field: 'bed_size',
    options: { matrimonial: VAN, queen: VAN, single: VAN, King: TRUCK },
    fallback: TRUCK,
  },
  Bench: UV,
  bedside: { field: 'number', options: { one: HATCHBACK, two: SUV }, fallback: SUV },
  closet: UV,
  dresser: UV,
  mattress: {
    field: 'bed_size',
    options: { matrimonial: VAN, queen: VAN, single: VAN, King: TRUCK },
    fallback: TRUCK,
  },
  Vanity: UV,

  // Living room
  Armchair: UV,
  Bookshelf: VAN,
  'coffee-table': UV,
  couch: {
    field: 'couch_type',
    options: {
      '2-seater': UV,
      '3-seater': TRUCK,
      '4-seater': TRUCK,
      'l-shaped': TRUCK,
      'sofa-bed': TRUCK,
    },
    fallback: TRUCK,
  },
  'side-table-living': HATCHBACK,
  'TV-console': UV,

  // Dining
  'bar-cart': UV,
  'bar-stool': SUV,
  'cabinet-dining': UV,
  'chair-dining': {
    field: 'number_of_chairs',
    options: { one: HATCHBACK, two: SUV, four: PICKUP, six: PICKUP, eight: PICKUP },
    fallback: PICKUP,
  },
  'dining-table': {
    field: 'table_size',
    options: {
      'small-2-people': SUV,
      'medium-4-people': VAN,
      'large-6-people': VAN,
      'large-8-people': TRUCK,
    },
    fallback: TRUCK,
  },

  // Kitchen
  cookware: HATCHBACK,
  cutlery: MOTORCYCLE,
  glasses: HATCHBACK,
  'storage-kitchen': SEDAN,
  'utensils-kitchen': MOTORCYCLE,
  Serving: SEDAN,
  Tableware: HATCHBACK,
  'trashbin-kitch': HATCHBACK,

  // Baby & Kids
  bassinet: SUV,
  'bed-kids': VAN,
  crib: UV,
  'desk-kids': SUV,
  'high-chair-baby': SUV,
  'nursing-chair': UV,
  playroom: SUV,
  'Sports-kids': SUV,
  stroller: SEDAN,
  toys: HATCHBACK,

  // Bathroom
  'accessories-bathroom': MOTORCYCLE,
  'cabinet-bathroom': UV,
  laundry: HATCHBACK,
  'trashbin-bathroom': HATCHBACK,

  // Office
  desk: UV,
  'chair-office': SUV,
  'office-supplies': HATCHBACK,

  // Outdoor
  'outdoor-loung': TRUCK,
  'outdoor-dining': VAN,
  Hammock: PICKUP,
  'sun-lounger': VAN,
  parasol: PICKUP,
  'Outdoor-planters': SUV,

  // Storage
  Entryway: PICKUP,
  hangers: HATCHBACK,
  'boxes-storage': HATCHBACK,
  'storage-cabinets': UV,
  organizer: SUV,

  // Textiles
  blanket: MOTORCYCLE,
  carpets: {
    field: 'carpet_size',
    options: { small: HATCHBACK, medium: PICKUP, large: UV },
    fallback: UV,
  },
  curtains: HATCHBACK,
  'table-linens': MOTORCYCLE,

  // Decor
  Art: SUV,
  candles: MOTORCYCLE,
  books: HATCHBACK,
  // Table lamps go by car (sedan), floor lamps by UV. There's no listing field for the lamp type yet.
  lighting: UV,
  'decor-other': HATCHBACK,
  frames: HATCHBACK,
  pillows: HATCHBACK,
  vases: HATCHBACK,

  // Hobbies
  'DYI-tools': HATCHBACK,
  'music-equipment': SUV,
  camping: SUV,
  Sport: SUV,
};

// Used if the listing's subcategory is not in the mapping (e.g. a new subcategory in Console).
const DEFAULT_VEHICLE = VAN;

/**
 * Returns the vehicle needed to deliver the listing.
 *
 * @param {Object} publicData listing's public data
 * @returns {{ vehicle: string, isDefault: boolean }}
 */
const getVehicleForListing = publicData => {
  const mapping = SUBCATEGORY_VEHICLES[(publicData?.categoryLevel2)];
  if (!mapping) {
    return { vehicle: DEFAULT_VEHICLE, isDefault: true };
  }
  if (typeof mapping === 'string') {
    return { vehicle: mapping, isDefault: false };
  }
  const variant = publicData?.[mapping.field];
  return { vehicle: mapping.options[variant] || mapping.fallback, isDefault: false };
};

module.exports = { SUBCATEGORY_VEHICLES, DEFAULT_VEHICLE, getVehicleForListing };
