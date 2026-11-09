// Hand-over errors from the server (error's statusText).
// Note: keep in sync with HANDOVER_ERROR_CODES in server/services/handover/index.js
export const HANDOVER_ERROR_CODES = {
  WRONG_PIN: 'handover-wrong-pin',
  LOCKED: 'handover-locked',
  NOT_ALLOWED: 'handover-not-allowed',
};

// Time windows for the pick-up / collection day the provider confirms.
// Note: the same options as the buyer's "Preferred Delivery or Pick Up Window" transaction field.
export const HANDOVER_TIME_WINDOWS = ['morning', 'afternoon', 'evening'];

/**
 * Returns the translation id for a hand-over error.
 *
 * @param {Object} error storable error from confirmHandover
 * @returns {string}
 */
export const getHandoverErrorMessageId = error => {
  const code = Object.values(HANDOVER_ERROR_CODES).find(c => c === error?.statusText);
  return code ? `HandoverPin.error.${code}` : 'HandoverPin.error.generic';
};
