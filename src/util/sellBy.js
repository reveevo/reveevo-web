/**
 * Reveevo: "Sell by" deadline of a listing.
 *
 * It's a listing field defined in Console (key 'sellBy', schema type 'long', with sorting on). The
 * value is a unix timestamp in seconds: the end of the chosen day in Mexico City time. Sellers
 * pick a date (not a number) in the listing editor, and the listing page shows the date.
 */
export const SELL_BY_FIELD_KEY = 'sellBy';

// Mexico City time (no daylight saving time since 2022)
const MEXICO_CITY_UTC_OFFSET = '-06:00';
const MEXICO_CITY_OFFSET_SECONDS = -6 * 60 * 60;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether the listing field is the "Sell by" deadline.
 *
 * @param {string} key listing field key
 * @returns {boolean}
 */
export const isSellByField = key => key === SELL_BY_FIELD_KEY;

/**
 * Date (YYYY-MM-DD) to the unix timestamp (seconds) of the end of that day in Mexico City.
 *
 * @param {string} date e.g. '2026-11-30'
 * @returns {number|null}
 */
export const sellByDateToTimestamp = date => {
  if (typeof date !== 'string' || !DATE_PATTERN.test(date)) {
    return null;
  }
  const time = new Date(`${date}T23:59:59${MEXICO_CITY_UTC_OFFSET}`).getTime();
  return Number.isNaN(time) ? null : Math.floor(time / 1000);
};

/**
 * Unix timestamp (seconds) to the date (YYYY-MM-DD) it falls on in Mexico City.
 *
 * @param {number} timestamp
 * @returns {string} e.g. '2026-11-30', or '' for no value
 */
export const sellByTimestampToDate = timestamp =>
  Number.isFinite(timestamp)
    ? new Date((timestamp + MEXICO_CITY_OFFSET_SECONDS) * 1000).toISOString().slice(0, 10)
    : '';

/**
 * Tomorrow's date (YYYY-MM-DD) in Mexico City: the earliest deadline a seller can pick.
 *
 * @param {Date} [now]
 * @returns {string}
 */
export const getEarliestSellByDate = (now = new Date()) =>
  sellByTimestampToDate(Math.floor(now.getTime() / 1000) + 24 * 60 * 60);

/**
 * The deadline formatted for display, e.g. "Nov 30, 2026".
 *
 * @param {Object} intl
 * @param {number} timestamp
 * @returns {string|null}
 */
export const formatSellByDate = (intl, timestamp) =>
  Number.isFinite(timestamp)
    ? intl.formatDate(timestamp * 1000, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Mexico_City',
      })
    : null;

const SELL_BY_SORT_KEYS = [`-pub_${SELL_BY_FIELD_KEY}`, `pub_${SELL_BY_FIELD_KEY}`];

/**
 * Sorting by the deadline: listings without one come last (Marketplace API), and among them the
 * newest come first.
 *
 * @param {string} [sort] e.g. '-pub_sellBy' (soonest deadline first)
 * @returns {string|undefined}
 */
export const withSellBySortTieBreak = sort =>
  SELL_BY_SORT_KEYS.includes(sort) ? `${sort},createdAt` : sort;

/**
 * The translation key of a deadline sort option ('-pub_sellBy' is ascending: soonest first).
 *
 * @param {string} sortKey
 * @returns {string|null}
 */
export const getSellBySortLabelKey = sortKey =>
  sortKey === SELL_BY_SORT_KEYS[0]
    ? 'SortBy.sellBySoonest'
    : sortKey === SELL_BY_SORT_KEYS[1]
    ? 'SortBy.sellByLatest'
    : null;
