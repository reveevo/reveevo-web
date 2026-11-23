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

/**
 * Throws a 403 error (statusText: 'not-admin') unless the current user is one of Reveevo's
 * admins: profile.metadata.isAdmin is true. Metadata can only be set by the operator (Console or
 * Integration API), so users can't make themselves admins.
 *
 * @param {Object} sdk Marketplace API SDK of the current user
 * @returns {Promise<string>} the admin's user id
 */
const assertAdmin = async sdk => {
  const response = await sdk.currentUser.show();
  const user = response?.data?.data;
  if (user?.attributes?.profile?.metadata?.isAdmin !== true) {
    const error = new Error('not-admin');
    error.status = 403;
    error.statusText = 'not-admin';
    error.data = { code: 'not-admin' };
    throw error;
  }
  return user.id.uuid;
};

module.exports = { EMAIL_NOT_VERIFIED, requiresVerifiedEmail, assertEmailVerified, assertAdmin };
