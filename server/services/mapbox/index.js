const DIRECTIONS_API_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

let hostedAccessToken = null;

/**
 * Returns the Mapbox access token. It's read from env (REACT_APP_MAPBOX_ACCESS_TOKEN) or,
 * if not set there, from the hosted map config in Console.
 *
 * @param {Object} sdk Marketplace API SDK (used to read the hosted asset)
 * @returns {Promise<string>}
 */
const getAccessToken = async sdk => {
  const envToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
  if (envToken) {
    return envToken;
  }
  if (!hostedAccessToken) {
    const response = await sdk.assetsByAlias({
      paths: ['integrations/map.json'],
      alias: 'latest',
    });
    hostedAccessToken = response?.data?.data?.[0]?.attributes?.data?.mapboxAccessToken || null;
  }
  if (!hostedAccessToken) {
    throw new Error('Mapbox access token is not set.');
  }
  return hostedAccessToken;
};

/**
 * Returns the driving distance in kilometers between two points.
 *
 * @param {Object} params
 * @param {{ lat: number, lng: number }} params.from
 * @param {{ lat: number, lng: number }} params.to
 * @param {Object} params.sdk Marketplace API SDK (for reading the hosted Mapbox token)
 * @returns {Promise<number|null>} distance in km, or null if no route was found
 */
const getDrivingDistanceKm = async ({ from, to, sdk }) => {
  const accessToken = await getAccessToken(sdk);
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${DIRECTIONS_API_URL}/${coordinates}?overview=false&access_token=${accessToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox Directions API request failed with status ${response.status}`);
  }
  const body = await response.json();
  const meters = body?.routes?.[0]?.distance;
  return typeof meters === 'number' ? meters / 1000 : null;
};

module.exports = { getDrivingDistanceKm };
