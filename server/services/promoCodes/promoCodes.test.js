jest.mock('../firebase', () => ({ getFirestore: jest.fn(), FieldValue: {} }));

const { types } = require('sharetribe-flex-sdk');
const { getMaxPromoPercentage, getPromoDiscountLineItemMaybe } = require('./discount');
const { validatePromoCodeInput } = require('./codes');

const { Money } = types;

// MX$1,000 item, 20% provider + 10% customer commission = MX$300 commission
const lineItems = [
  { code: 'line-item/item', unitPrice: new Money(100000, 'MXN'), quantity: 1 },
  { code: 'line-item/provider-commission', unitPrice: new Money(100000, 'MXN'), percentage: -20 },
  { code: 'line-item/customer-commission', unitPrice: new Money(100000, 'MXN'), percentage: 10 },
];

const discountOf = promoCode =>
  getPromoDiscountLineItemMaybe(lineItems, promoCode, 'MXN')[0]?.unitPrice.amount;

describe('promo code discount', () => {
  it('takes a percentage of the item price, for the customer only', () => {
    const [item] = getPromoDiscountLineItemMaybe(
      lineItems,
      { discountType: 'percentage', percentage: 10 },
      'MXN'
    );
    expect(item).toMatchObject({ code: 'line-item/promo-discount', quantity: 1 });
    expect(item.includeFor).toEqual(['customer']);
    expect(item.unitPrice.amount).toBe(-10000);
  });

  it('is never more than the commission', () => {
    expect(discountOf({ discountType: 'fixed', amount: 50000, currency: 'MXN' })).toBe(-30000);
    expect(discountOf({ discountType: 'percentage', percentage: 50 })).toBe(-30000);
  });

  it('ignores fixed codes in another currency, and no code', () => {
    expect(discountOf({ discountType: 'fixed', amount: 5000, currency: 'USD' })).toBeUndefined();
    expect(getPromoDiscountLineItemMaybe(lineItems, null, 'MXN')).toEqual([]);
  });

  it('allows at most the total commission percentage', () => {
    expect(getMaxPromoPercentage({ percentage: 20 }, { percentage: 10 })).toBe(30);
    expect(getMaxPromoPercentage({ percentage: 20 }, undefined)).toBe(20);
  });
});

describe('promo code validation', () => {
  const options = { maxPercentage: 30, currency: 'MXN', isNew: true };

  it('accepts a valid code and normalizes it', () => {
    expect(
      validatePromoCodeInput(
        { code: ' summer10 ', discountType: 'percentage', percentage: 10 },
        options
      )
    ).toMatchObject({ code: 'SUMMER10', percentage: 10, maxUses: null, active: true });
  });

  it("rejects a percentage above Reveevo's commission", () => {
    expect(() =>
      validatePromoCodeInput({ code: 'BIG', discountType: 'percentage', percentage: 31 }, options)
    ).toThrow('invalid-percentage');
  });

  it('rejects invalid codes, amounts and expiry dates', () => {
    expect(() =>
      validatePromoCodeInput({ code: 'a!', discountType: 'percentage', percentage: 5 }, options)
    ).toThrow('invalid-code');
    expect(() =>
      validatePromoCodeInput({ code: 'FIX', discountType: 'fixed', amount: 0 }, options)
    ).toThrow('invalid-amount');
    expect(() =>
      validatePromoCodeInput(
        { code: 'OLD', discountType: 'fixed', amount: 100, expiresAt: '2020-01-01' },
        options
      )
    ).toThrow('invalid-expiry');
  });

  it('stores fixed codes in the marketplace currency', () => {
    expect(
      validatePromoCodeInput({ code: 'FIX', discountType: 'fixed', amount: 5000 }, options)
    ).toMatchObject({ amount: 5000, currency: 'MXN', percentage: null });
  });
});

describe('returning a promo code use when an order is declined', () => {
  const { returnPromoCodeUseMaybe } = require('./index');

  it('does nothing for orders without a promo code use', async () => {
    await expect(
      returnPromoCodeUseMaybe(
        { id: { uuid: 'tx-1' }, attributes: { protectedData: {} } },
        'transition/provider-decline-order'
      )
    ).resolves.toBe(false);
    await expect(
      returnPromoCodeUseMaybe(
        { id: { uuid: 'tx-1' }, attributes: { protectedData: { promoCode: { code: 'OLD' } } } },
        'transition/provider-decline-order'
      )
    ).resolves.toBe(false);
  });
});
