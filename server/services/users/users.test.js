const { assertEmailVerified, requiresVerifiedEmail } = require('./index');

const sdkFor = emailVerified => ({
  currentUser: {
    show: jest.fn().mockResolvedValue({ data: { data: { attributes: { emailVerified } } } }),
  },
});

describe('email verification', () => {
  it('is needed for payments and offers', () => {
    expect(requiresVerifiedEmail('transition/request-payment')).toBe(true);
    expect(requiresVerifiedEmail('transition/customer-make-offer')).toBe(true);
    expect(requiresVerifiedEmail('transition/request-payment-after-offer')).toBe(true);
    expect(requiresVerifiedEmail('transition/inquire')).toBe(false);
  });

  it('throws for an unverified user', async () => {
    await expect(assertEmailVerified(sdkFor(false))).rejects.toMatchObject({
      status: 403,
      statusText: 'email-not-verified',
    });
    await expect(assertEmailVerified(sdkFor(true))).resolves.toBeUndefined();
  });
});
