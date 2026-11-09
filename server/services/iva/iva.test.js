const { types } = require('sharetribe-flex-sdk');
const { getIvaLineItemMaybe } = require('./index');

const { Money } = types;

describe('getIvaLineItemMaybe', () => {
  const order = {
    code: 'line-item/item',
    unitPrice: new Money(50000, 'MXN'),
    quantity: 1,
    includeFor: ['customer', 'provider'],
  };

  it('charges 16% of shipping and both commissions to the customer', () => {
    const lineItems = [
      order,
      {
        code: 'line-item/shipping-fee',
        unitPrice: new Money(10000, 'MXN'),
        quantity: 1,
        includeFor: ['customer'],
      },
      {
        code: 'line-item/provider-commission',
        unitPrice: new Money(50000, 'MXN'),
        percentage: -20,
        includeFor: ['provider'],
      },
      {
        code: 'line-item/customer-commission',
        unitPrice: new Money(50000, 'MXN'),
        percentage: 10,
        includeFor: ['customer'],
      },
    ];
    // (100 + 100 + 50) MXN * 16% = 40 MXN
    expect(getIvaLineItemMaybe(lineItems, 'MXN')).toEqual([
      {
        code: 'line-item/iva',
        unitPrice: new Money(4000, 'MXN'),
        quantity: 1,
        includeFor: ['customer'],
      },
    ]);
  });

  it('adds nothing when there is nothing to tax', () => {
    expect(getIvaLineItemMaybe([order], 'MXN')).toEqual([]);
  });
});
