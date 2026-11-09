const { types } = require('sharetribe-flex-sdk');
const { getOfferPricing } = require('./index');

const { Money, UUID } = types;

const LISTING_ID = 'listing-1';
const CUSTOMER_ID = 'customer-1';

const counterOfferedTx = ({ state = 'state/counter-offered', customerId = CUSTOMER_ID } = {}) => ({
  id: new UUID('tx-1'),
  attributes: {
    state,
    metadata: {
      offers: [
        { offerInSubunits: 80000, by: 'customer', transition: 'transition/customer-make-offer' },
        {
          offerInSubunits: 90000,
          by: 'provider',
          transition: 'transition/provider-make-counter-offer',
        },
      ],
    },
    lineItems: [{ code: 'line-item/item', quantity: 1 }],
  },
  relationships: {
    listing: { data: { id: { uuid: LISTING_ID } } },
    customer: { data: { id: { uuid: customerId } } },
  },
});

const mockSdk = tx => ({
  transactions: { show: jest.fn().mockResolvedValue({ data: { data: tx } }) },
  currentUser: {
    show: jest.fn().mockResolvedValue({ data: { data: { id: { uuid: CUSTOMER_ID } } } }),
  },
});

describe('getOfferPricing', () => {
  it('uses the customer offer for a new offer', async () => {
    const pricing = await getOfferPricing({
      sdk: mockSdk(null),
      transitionName: 'transition/customer-make-offer',
      orderData: { offerInSubunits: 80000 },
      listingId: LISTING_ID,
      currency: 'MXN',
    });
    expect(pricing.offer).toEqual(new Money(80000, 'MXN'));
    expect(pricing.metadata.offers).toHaveLength(1);
    expect(pricing.transactionToClose).toBeNull();
  });

  it('rejects an offer without a valid amount', async () => {
    await expect(
      getOfferPricing({
        sdk: mockSdk(null),
        transitionName: 'transition/customer-make-offer',
        orderData: { offerInSubunits: 0 },
        listingId: LISTING_ID,
        currency: 'MXN',
      })
    ).rejects.toThrow('Offer is missing a valid amount');
  });

  it('reads the counter offer from the earlier transaction', async () => {
    const pricing = await getOfferPricing({
      sdk: mockSdk(counterOfferedTx()),
      transitionName: 'transition/request-payment-for-counter-offer',
      orderData: { counterOfferTransactionId: 'tx-1', offerInSubunits: 1 },
      listingId: LISTING_ID,
      currency: 'MXN',
    });
    expect(pricing.offer).toEqual(new Money(90000, 'MXN'));
    expect(pricing.quantity).toBe(1);
    expect(pricing.transactionToClose.transition).toBe('transition/customer-accept-counter-offer');
  });

  it('rejects a counter offer that is no longer open or belongs to someone else', async () => {
    const params = {
      transitionName: 'transition/request-payment-for-counter-offer',
      orderData: { counterOfferTransactionId: 'tx-1' },
      listingId: LISTING_ID,
      currency: 'MXN',
    };
    await expect(
      getOfferPricing({
        ...params,
        sdk: mockSdk(counterOfferedTx({ state: 'state/offer-expired' })),
      })
    ).rejects.toThrow('Counter offer is not available');
    await expect(
      getOfferPricing({ ...params, sdk: mockSdk(counterOfferedTx({ customerId: 'someone-else' })) })
    ).rejects.toThrow('Counter offer is not available');
  });
});
