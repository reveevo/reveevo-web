// Reveevo: buying and making offers need a verified email address.
// Note: keep the error code in sync with src/containers/CheckoutPage/ErrorMessages.js
const EMAIL_NOT_VERIFIED = 'email-not-verified';

const VERIFIED_EMAIL_TRANSITIONS = [
  'transition/request-payment',
  'transition/request-payment-after-inquiry',
  'transition/request-payment-after-offer',
  'transition/customer-make-offer',
  'transition/customer-make-counter-offer',
];

/**
 * Checks if the transition needs the current user to have a verified email.
 *
 * @param {string} transitionName
 * @returns {boolean}
 */
const requiresVerifiedEmail = transitionName => VERIFIED_EMAIL_TRANSITIONS.includes(transitionName);

/**
 * Throws a 403 error (statusText: 'email-not-verified') if the current user's email address is
 * not verified.
 *
 * @param {Object} sdk Marketplace API SDK of the current user
 */
const assertEmailVerified = async sdk => {
  const response = await sdk.currentUser.show();
  if (!response?.data?.data?.attributes?.emailVerified) {
    const error = new Error(EMAIL_NOT_VERIFIED);
    error.status = 403;
    error.statusText = EMAIL_NOT_VERIFIED;
    error.data = { code: EMAIL_NOT_VERIFIED };
    throw error;
  }
};

module.exports = { EMAIL_NOT_VERIFIED, requiresVerifiedEmail, assertEmailVerified };
