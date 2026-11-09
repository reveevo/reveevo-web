jest.mock('../../api-util/sdk', () => ({ getIntegrationSdk: jest.fn() }));

const { getIntegrationSdk } = require('../../api-util/sdk');
const { confirmHandover, getHandoverPin, HANDOVER_ERROR_CODES } = require('./index');

const TX_ID = '6a1b2c3d-0000-4000-8000-000000000001';
const PROVIDER_ID = 'provider-id';

const mockIntegrationSdk = ({ state = 'state/purchased', deliveryMethod, attempts } = {}) => {
  const iSdk = {
    transactions: {
      show: jest.fn().mockResolvedValue({
        data: {
          data: {
            attributes: {
              state,
              protectedData: { deliveryMethod },
              metadata: attempts ? { handoverPinAttempts: attempts } : {},
            },
            relationships: { provider: { data: { id: { uuid: PROVIDER_ID } } } },
          },
        },
      }),
      updateMetadata: jest.fn().mockResolvedValue({}),
      transition: jest.fn().mockResolvedValue({}),
    },
  };
  getIntegrationSdk.mockReturnValue(iSdk);
  return iSdk;
};

describe('handover', () => {
  beforeAll(() => {
    process.env.HANDOVER_PIN_SECRET = 'test-secret';
  });

  it('derives a 6 digit PIN per transaction', () => {
    const pin = getHandoverPin(TX_ID);
    expect(pin).toMatch(/^\d{6}$/);
    expect(getHandoverPin(TX_ID)).toBe(pin);
    expect(getHandoverPin('another-transaction')).not.toBe(pin);
  });

  it('completes a pick up when the provider enters the right PIN', async () => {
    const iSdk = mockIntegrationSdk({ deliveryMethod: 'pickup' });
    const result = await confirmHandover({
      transactionId: TX_ID,
      pin: getHandoverPin(TX_ID),
      currentUserId: PROVIDER_ID,
    });
    expect(result.transition).toBe('transition/operator-confirm-handover');
    expect(iSdk.transactions.transition).toHaveBeenCalled();
  });

  it('lets only the provider confirm a pick up', async () => {
    mockIntegrationSdk({ deliveryMethod: 'pickup' });
    await expect(
      confirmHandover({ transactionId: TX_ID, pin: getHandoverPin(TX_ID), currentUserId: null })
    ).rejects.toMatchObject({ statusText: HANDOVER_ERROR_CODES.NOT_ALLOWED });
  });

  it('lets the courier confirm a collected delivery', async () => {
    mockIntegrationSdk({ deliveryMethod: 'shipping', state: 'state/collected' });
    const result = await confirmHandover({
      transactionId: TX_ID,
      pin: getHandoverPin(TX_ID),
      currentUserId: null,
    });
    expect(result.transition).toBe('transition/operator-confirm-delivery');
  });

  it('counts wrong PINs and locks after too many', async () => {
    const iSdk = mockIntegrationSdk({ deliveryMethod: 'shipping', attempts: 2 });
    await expect(
      confirmHandover({ transactionId: TX_ID, pin: '000000x', currentUserId: null })
    ).rejects.toMatchObject({ statusText: HANDOVER_ERROR_CODES.WRONG_PIN });
    expect(iSdk.transactions.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { handoverPinAttempts: 3 } })
    );

    mockIntegrationSdk({ deliveryMethod: 'shipping', attempts: 5 });
    await expect(
      confirmHandover({ transactionId: TX_ID, pin: getHandoverPin(TX_ID), currentUserId: null })
    ).rejects.toMatchObject({ statusText: HANDOVER_ERROR_CODES.LOCKED });
  });
});
