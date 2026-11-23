import {
  getCheckoutPaymentTransitions,
  getTransitionsWithMatchingOffers,
  isNegotiationState,
  isValidNegotiationOffersArray,
  transitions,
} from './transactionProcessPurchase';

describe('transactionProcessPurchase offers', () => {
  const pastTransitions = [
    { transition: transitions.CUSTOMER_MAKE_OFFER, by: 'customer' },
    { transition: transitions.PROVIDER_MAKE_COUNTER_OFFER, by: 'provider' },
    { transition: transitions.CUSTOMER_ACCEPT_COUNTER_OFFER, by: 'customer' },
  ];
  const offers = [
    { offerInSubunits: 8000, by: 'customer', transition: transitions.CUSTOMER_MAKE_OFFER },
    { offerInSubunits: 9000, by: 'provider', transition: transitions.PROVIDER_MAKE_COUNTER_OFFER },
  ];

  it('isValidNegotiationOffersArray validates offers against transitions', () => {
    expect(isValidNegotiationOffersArray(pastTransitions, offers)).toBe(true);
    expect(isValidNegotiationOffersArray(pastTransitions, offers.slice(0, 1))).toBe(false);
    expect(
      isValidNegotiationOffersArray(pastTransitions, [offers[0], { ...offers[1], by: 'customer' }])
    ).toBe(false);
    expect(isValidNegotiationOffersArray(pastTransitions, undefined)).toBe(false);
  });

  it('isNegotiationState is true only when an offer waits for a response', () => {
    expect(isNegotiationState('state/offer-pending')).toBe(true);
    expect(isNegotiationState('counter-offer-pending')).toBe(true);
    expect(isNegotiationState('state/offer-accepted')).toBe(false);
    expect(isNegotiationState(null)).toBe(false);
  });

  it('getTransitionsWithMatchingOffers adds offers to offer transitions', () => {
    const result = getTransitionsWithMatchingOffers(pastTransitions, offers);
    expect(result.map(t => t.offerInSubunits)).toEqual([8000, 9000, undefined]);
    expect(getTransitionsWithMatchingOffers(pastTransitions, [])).toBe(pastTransitions);
  });
});

describe('transactionProcessPurchase checkout transitions', () => {
  const card = { paymentProcessor: 'stripe', paymentMethod: 'card' };

  it('pays a direct order, an inquiry and an accepted offer with their own transitions', () => {
    expect(getCheckoutPaymentTransitions({ ...card }).requestPaymentTransition).toBe(
      transitions.REQUEST_PAYMENT
    );
    expect(
      getCheckoutPaymentTransitions({ ...card, state: 'inquiry' }).requestPaymentTransition
    ).toBe(transitions.REQUEST_PAYMENT_AFTER_INQUIRY);
    expect(
      getCheckoutPaymentTransitions({ ...card, state: 'offer-accepted' }).requestPaymentTransition
    ).toBe(transitions.REQUEST_PAYMENT_AFTER_OFFER);
  });
});
