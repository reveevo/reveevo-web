import {
  getEarliestSellByDate,
  getSellBySortLabelKey,
  sellByDateToTimestamp,
  sellByTimestampToDate,
  withSellBySortTieBreak,
} from './sellBy';

describe('sellBy', () => {
  it('stores the end of the chosen day in Mexico City as a unix timestamp', () => {
    // 2026-11-30 23:59:59 at UTC-6 = 2026-12-01 05:59:59 UTC
    expect(sellByDateToTimestamp('2026-11-30')).toBe(Date.UTC(2026, 11, 1, 5, 59, 59) / 1000);
    expect(sellByDateToTimestamp('')).toBeNull();
    expect(sellByDateToTimestamp('30/11/2026')).toBeNull();
  });

  it('turns the timestamp back into the same date', () => {
    const timestamp = sellByDateToTimestamp('2026-11-30');
    expect(sellByTimestampToDate(timestamp)).toBe('2026-11-30');
    expect(sellByTimestampToDate(null)).toBe('');
  });

  it('lets sellers pick from tomorrow (Mexico City time)', () => {
    // 2026-11-23 20:00 in Mexico City is already 2026-11-24 in UTC
    const now = new Date('2026-11-24T02:00:00Z');
    expect(getEarliestSellByDate(now)).toBe('2026-11-24');
  });

  it('sorts listings without a deadline newest first', () => {
    expect(withSellBySortTieBreak('-pub_sellBy')).toBe('-pub_sellBy,createdAt');
    expect(withSellBySortTieBreak('-price')).toBe('-price');
    expect(withSellBySortTieBreak(undefined)).toBeUndefined();
  });

  it('labels the deadline sort options', () => {
    expect(getSellBySortLabelKey('-pub_sellBy')).toBe('SortBy.sellBySoonest');
    expect(getSellBySortLabelKey('pub_sellBy')).toBe('SortBy.sellByLatest');
    expect(getSellBySortLabelKey('-price')).toBeNull();
  });
});

describe('sellBy sort options from the Console field', () => {
  const { getSortOptionsFromListingFields } = require('../config/search/search');

  it('puts "Deadline: soonest first" first, so it is the default sort', () => {
    const consoleField = {
      key: 'sellBy',
      scope: 'public',
      schemaType: 'long',
      filterConfig: {
        indexForSearch: true,
        showSorting: true,
        sortingGroup: 'primary',
        sortingOrder: { asc: true, desc: true },
        label: 'Sell by',
      },
    };
    const { primaryOptions } = getSortOptionsFromListingFields([consoleField]);
    expect(primaryOptions.map(o => [o.key, o.labelTranslationKey])).toEqual([
      ['-pub_sellBy', 'SortBy.sellBySoonest'],
      ['pub_sellBy', 'SortBy.sellByLatest'],
    ]);
  });
});
