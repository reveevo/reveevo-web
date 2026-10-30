/**
 * Reveevo shipping fees (MXN, IVA included).
 * Source: "Shipping fees and mapping" spreadsheet, sheet "Shipping Fees".
 *
 * The fee depends on the vehicle needed for the item and the driving distance between the seller
 * and the buyer. Distances over the last band are not served (only pickup is possible).
 */

const VEHICLES = {
  MOTORCYCLE: 'motorcycle',
  HATCHBACK: 'hatchback',
  SEDAN: 'sedan',
  SUV: 'suv',
  PICKUP: 'pickup',
  UV: 'uv',
  VAN: 'van',
  TRUCK: 'truck',
};

// Motorcycle can only be used up to 20 km. Over that, the Hatchback rate applies.
const MOTORCYCLE_MAX_DISTANCE_KM = 20;

// Bigger vehicles always have a second person booked (included in the fee).
const VEHICLES_WITH_TWO_PEOPLE = [VEHICLES.UV, VEHICLES.VAN, VEHICLES.TRUCK];

// Fees in MXN per distance band. A band covers distances up to (and including) maxDistanceKm.
const FEE_BANDS = [
  {
    maxDistanceKm: 5,
    fees: {
      motorcycle: 55,
      hatchback: 85,
      sedan: 95,
      suv: 280,
      pickup: 380,
      uv: 675,
      van: 885,
      truck: 1350,
    },
  },
  {
    maxDistanceKm: 10,
    fees: {
      motorcycle: 90,
      hatchback: 130,
      sedan: 145,
      suv: 365,
      pickup: 510,
      uv: 795,
      van: 1060,
      truck: 1685,
    },
  },
  {
    maxDistanceKm: 15,
    fees: {
      motorcycle: 125,
      hatchback: 175,
      sedan: 195,
      suv: 455,
      pickup: 625,
      uv: 900,
      van: 1210,
      truck: 1970,
    },
  },
  {
    maxDistanceKm: 20,
    fees: {
      motorcycle: 155,
      hatchback: 225,
      sedan: 245,
      suv: 540,
      pickup: 735,
      uv: 1000,
      van: 1360,
      truck: 2260,
    },
  },
  {
    maxDistanceKm: 30,
    fees: { hatchback: 315, sedan: 350, suv: 715, pickup: 915, uv: 1165, van: 1595, truck: 2715 },
  },
  {
    maxDistanceKm: 40,
    fees: { hatchback: 405, sedan: 450, suv: 890, pickup: 1020, uv: 1260, van: 1735, truck: 2980 },
  },
  {
    maxDistanceKm: 50,
    fees: { hatchback: 500, sedan: 555, suv: 1065, pickup: 1125, uv: 1355, van: 1875, truck: 3250 },
  },
];

const MAX_DISTANCE_KM = FEE_BANDS[FEE_BANDS.length - 1].maxDistanceKm;

/**
 * Returns the shipping fee in MXN (major unit) for the vehicle and distance,
 * or null if the distance is out of the served area.
 *
 * @param {string} vehicle one of VEHICLES
 * @param {number} distanceKm driving distance
 * @returns {number|null}
 */
const getShippingFeeInMXN = (vehicle, distanceKm) => {
  const band = FEE_BANDS.find(b => distanceKm <= b.maxDistanceKm);
  if (!band) {
    return null;
  }
  const isMotorcycleTooFar =
    vehicle === VEHICLES.MOTORCYCLE && distanceKm > MOTORCYCLE_MAX_DISTANCE_KM;
  const rateVehicle = isMotorcycleTooFar ? VEHICLES.HATCHBACK : vehicle;
  return band.fees[rateVehicle] ?? null;
};

/**
 * Number of people needed for the delivery.
 *
 * @param {string} vehicle
 * @returns {number}
 */
const getPeopleNeeded = vehicle => (VEHICLES_WITH_TWO_PEOPLE.includes(vehicle) ? 2 : 1);

module.exports = {
  VEHICLES,
  MAX_DISTANCE_KM,
  getShippingFeeInMXN,
  getPeopleNeeded,
};
