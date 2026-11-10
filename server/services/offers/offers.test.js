const { assertOfferLimit, MAX_OFFERS_PER_TRANSACTION } = require('./index');

const offers = count => Array.from({ length: count }, () => ({ offerInSubunits: 1000 }));

describe('offer limit', () => {
  it('allows counter offers below the limit', () => {
    expect(() =>
      assertOfferLimit({
        processName: 'default-purchase',
        transitionName: 'transition/provider-make-counter-offer',
        existingOffers: offers(MAX_OFFERS_PER_TRANSACTION - 1),
      })
    ).not.toThrow();
  });

  it('rejects a counter offer once the limit is reached', () => {
    expect(() =>
      assertOfferLimit({
        processName: 'default-purchase',
        transitionName: 'transition/customer-make-counter-offer',
        existingOffers: offers(MAX_OFFERS_PER_TRANSACTION),
      })
    ).toThrow('offer-limit-reached');
  });

  it('ignores other transitions and processes', () => {
    const existingOffers = offers(MAX_OFFERS_PER_TRANSACTION);
    expect(() =>
      assertOfferLimit({
        processName: 'default-purchase',
        transitionName: 'transition/customer-accept-counter-offer',
        existingOffers,
      })
    ).not.toThrow();
    expect(() =>
      assertOfferLimit({
        processName: 'default-negotiation',
        transitionName: 'transition/customer-make-counter-offer',
        existingOffers,
      })
    ).not.toThrow();
  });
});
