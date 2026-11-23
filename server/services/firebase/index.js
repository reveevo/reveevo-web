/**
 * Firebase Admin SDK (Firestore), used on the server only.
 *
 * The service account credentials are read from the environment, so that the service account
 * JSON file never ends up in the repository:
 *   - FIREBASE_SERVICE_ACCOUNT: the service account JSON, as-is or base64 encoded
 */
const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getFirestore: getAdminFirestore, FieldValue } = require('firebase-admin/firestore');

// A named app, so that it can't clash with another Firebase app in the same process
const APP_NAME = 'reveevo';

// Error code when Firebase isn't set up on this server: features stored in Firestore aren't
// available there
const FEATURE_UNAVAILABLE = 'feature-unavailable';

let firestore = null;

const parseServiceAccount = () => {
  const value = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!value) {
    return null;
  }
  const json = value.startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
  return JSON.parse(json);
};

/**
 * Whether Firebase is set up on this server.
 *
 * @returns {boolean}
 */
const isFirebaseConfigured = () => !!(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();

/**
 * The error for a feature that needs Firestore when Firebase isn't set up (503, statusText
 * 'feature-unavailable').
 *
 * @returns {Error}
 */
const featureUnavailableError = () => {
  const error = new Error('Firebase is not set up (FIREBASE_SERVICE_ACCOUNT).');
  error.status = 503;
  error.statusText = FEATURE_UNAVAILABLE;
  error.data = { code: FEATURE_UNAVAILABLE };
  return error;
};

/**
 * The Firestore instance. The Firebase app is initialized on the first call. Throws
 * featureUnavailableError() when Firebase isn't set up.
 *
 * @returns {Object} Firestore
 */
const getFirestore = () => {
  if (firestore) {
    return firestore;
  }
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw featureUnavailableError();
  }
  const app = getApps().some(a => a.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp({ credential: cert(serviceAccount) }, APP_NAME);
  firestore = getAdminFirestore(app);
  return firestore;
};

module.exports = {
  FEATURE_UNAVAILABLE,
  FieldValue,
  featureUnavailableError,
  getFirestore,
  isFirebaseConfigured,
};
