const crypto = require('crypto');
const { types } = require('sharetribe-flex-integration-sdk');
const { getIntegrationSdk } = require('../../api-util/sdk');

const { UUID } = types;

// Hand-over (pick up by the buyer, or delivery by Reveevo's courier) is confirmed with a PIN
// that only the customer sees. The provider or the courier asks for it and enters it, and the
// server completes the order with an operator transition.
const PIN_LENGTH = 6;
const MAX_PIN_ATTEMPTS = 5;

// default-purchase process (release 3): states where the hand-over can be confirmed
const HANDOVER_TRANSITIONS = {
  'state/purchased': 'transition/operator-confirm-handover',
  'state/collected': 'transition/operator-confirm-delivery',
};

// Error codes are sent to the client as the error's statusText.
// Note: keep in sync with HANDOVER_ERROR_CODES in src/util/handover.js
const HANDOVER_ERROR_CODES = {
  WRONG_PIN: 'handover-wrong-pin',
  LOCKED: 'handover-locked',
  NOT_ALLOWED: 'handover-not-allowed',
};

const createHandoverError = (code, status = 400, data = {}) => {
  const error = new Error(code);
  error.status = status;
  error.statusText = code;
  error.data = { code, ...data };
  return error;
};

// The secret must stay on the server: without it, the PIN can't be calculated.
const getPinSecret = () => {
  const secret = process.env.HANDOVER_PIN_SECRET || process.env.SHARETRIBE_SDK_CLIENT_SECRET;
  if (!secret) {
    throw new Error('HANDOVER_PIN_SECRET is not set.');
  }
  return secret;
};

/**
 * Returns the hand-over PIN of the transaction (e.g. '042917').
 * The PIN is derived from the transaction id with a server secret, so it doesn't need to be
 * stored anywhere the provider could read it.
 *
 * @param {string} transactionId
 * @returns {string}
 */
const getHandoverPin = transactionId => {
  const digest = crypto
    .createHmac('sha256', getPinSecret())
    .update(`handover:${transactionId}`)
    .digest();
  const number = digest.readUInt32BE(0) % 10 ** PIN_LENGTH;
  return `${number}`.padStart(PIN_LENGTH, '0');
};

const isSamePin = (pin, expectedPin) => {
  const given = Buffer.from(`${pin || ''}`.trim());
  const expected = Buffer.from(expectedPin);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
};

/**
 * Returns the PIN for the customer of the transaction. Only the customer can see it.
 *
 * @param {Object} sdk Marketplace API SDK of the current user
 * @param {string} transactionId
 * @returns {Promise<{ pin: string }>}
 */
const getPinForCustomer = async (sdk, transactionId) => {
  const [txResponse, currentUserResponse] = await Promise.all([
    sdk.transactions.show({ id: transactionId, include: ['customer'] }),
    sdk.currentUser.show(),
  ]);
  const transaction = txResponse.data.data;
  const customerId = transaction.relationships?.customer?.data?.id?.uuid;
  if (customerId !== currentUserResponse.data.data.id.uuid) {
    throw createHandoverError(HANDOVER_ERROR_CODES.NOT_ALLOWED, 403);
  }
  return { pin: getHandoverPin(transaction.id.uuid) };
};

/**
 * Confirms the hand-over with the customer's PIN and completes the order.
 * - Pick up: only the provider of the transaction can confirm (they meet the buyer).
 * - Shipping: Reveevo's courier confirms the delivery (they don't need to be logged in).
 * After MAX_PIN_ATTEMPTS wrong PINs, the transaction is locked (the marketplace team can unlock
 * it by removing handoverPinAttempts from the transaction's metadata in Console).
 *
 * @param {Object} params
 * @param {string} params.transactionId
 * @param {string} params.pin
 * @param {string|null} params.currentUserId id of the logged in user (null for the courier)
 * @returns {Promise<{ transition: string }>}
 */
const confirmHandover = async ({ transactionId, pin, currentUserId }) => {
  const iSdk = getIntegrationSdk();
  const id = new UUID(transactionId);
  const txResponse = await iSdk.transactions.show({ id, include: ['provider'] });
  const transaction = txResponse.data.data;
  const { state, protectedData, metadata } = transaction.attributes;
  const isPickup = protectedData?.deliveryMethod === 'pickup';
  const providerId = transaction.relationships?.provider?.data?.id?.uuid;
  const transition = HANDOVER_TRANSITIONS[state];

  if (!transition || (isPickup && currentUserId !== providerId)) {
    throw createHandoverError(HANDOVER_ERROR_CODES.NOT_ALLOWED, 403);
  }

  const attempts = metadata?.handoverPinAttempts || 0;
  if (attempts >= MAX_PIN_ATTEMPTS) {
    throw createHandoverError(HANDOVER_ERROR_CODES.LOCKED, 423);
  }

  if (!isSamePin(pin, getHandoverPin(transactionId))) {
    await iSdk.transactions.updateMetadata({
      id,
      metadata: { handoverPinAttempts: attempts + 1 },
    });
    throw createHandoverError(HANDOVER_ERROR_CODES.WRONG_PIN, 400, {
      attemptsLeft: MAX_PIN_ATTEMPTS - attempts - 1,
    });
  }

  await iSdk.transactions.transition({ id, transition, params: {} });
  return { transition };
};

module.exports = {
  HANDOVER_ERROR_CODES,
  MAX_PIN_ATTEMPTS,
  getHandoverPin,
  getPinForCustomer,
  confirmHandover,
};
