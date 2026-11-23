const { FieldValue, getFirestore } = require('../firebase');
const { DISCOUNT_FIXED, DISCOUNT_PERCENTAGE, MARKETPLACE_CURRENCY } = require('./constants');

/**
 * Promo codes created by Reveevo's admins (users with profile.metadata.isAdmin), stored in
 * Firestore. The document id is the code itself, so the same code can't be created twice:
 *
 *   promoCodes/{CODE} {
 *     code: 'SUMMER10',                 // what customers enter (uppercase)
 *     discountType: 'percentage' | 'fixed',
 *     percentage: 10,                   // percentage codes: % off the item price
 *     amount: 5000, currency: 'MXN',    // fixed codes, in minor units
 *     maxUses: 100 | null,              // null: unlimited
 *     usesCount: 0,                     // increased when an order is placed with the code
 *     expiresAt: Timestamp | null,
 *     active: true,
 *     createdById: '<user id>',
 *     createdAt, updatedAt
 *   }
 *
 * Reveevo pays the discount from its commission: a percentage code can be at most the total
 * commission percentage, and every discount is capped at the order's commission at checkout
 * (see discount.js).
 */

const COLLECTION = 'promoCodes';
const CODE_PATTERN = /^[A-Z0-9_-]{3,20}$/;

const promoCodeError = (status, code, data = {}) => {
  const error = new Error(code);
  error.status = status;
  error.statusText = code;
  error.data = { code, ...data };
  return error;
};

const isWholeNumber = (value, min, max = Number.MAX_SAFE_INTEGER) =>
  Number.isInteger(value) && value >= min && value <= max;

/**
 * Code as stored and entered: trimmed and uppercase.
 *
 * @param {string} code
 * @returns {string}
 */
const normalizeCode = code => (typeof code === 'string' ? code.trim().toUpperCase() : '');

const isValidCode = code => CODE_PATTERN.test(code);

const toMillis = value => (value?.toMillis ? value.toMillis() : value || null);

/**
 * Promo code document as JSON for the web app (timestamps in milliseconds).
 *
 * @param {Object} doc Firestore document snapshot
 * @returns {Object}
 */
const serializePromoCode = doc => {
  const data = doc.data();
  return {
    id: doc.id,
    code: data.code,
    discountType: data.discountType,
    percentage: data.percentage ?? null,
    amount: data.amount ?? null,
    currency: data.currency ?? null,
    maxUses: data.maxUses ?? null,
    usesCount: data.usesCount || 0,
    expiresAt: toMillis(data.expiresAt),
    active: data.active !== false,
    createdAt: toMillis(data.createdAt),
  };
};

/**
 * Validated values of a promo code, or throws a 400 error with the reason (statusText).
 *
 * @param {Object} input From the web app
 * @param {Object} options
 * @param {number} options.maxPercentage Highest percentage allowed (the total commission %)
 * @param {string} options.currency The marketplace currency (fixed codes)
 * @param {boolean} [options.isNew] Validate the code too (it can't be changed later)
 * @param {Date} [options.now]
 * @returns {Object} Values to store (without timestamps and the creator)
 */
const validatePromoCodeInput = (
  input,
  { maxPercentage, currency, isNew = false, now = new Date() }
) => {
  const {
    code,
    discountType,
    percentage,
    amount,
    maxUses = null,
    expiresAt = null,
    active = true,
  } = input || {};
  const values = {};

  if (isNew) {
    const normalized = normalizeCode(code);
    if (!isValidCode(normalized)) {
      throw promoCodeError(400, 'invalid-code');
    }
    values.code = normalized;
  }

  if (discountType === DISCOUNT_PERCENTAGE) {
    // Reveevo can't give away more than the commission it takes
    if (!isWholeNumber(percentage, 1, Math.max(1, Math.floor(maxPercentage)))) {
      throw promoCodeError(400, 'invalid-percentage', { maxPercentage });
    }
    Object.assign(values, { discountType, percentage, amount: null, currency: null });
  } else if (discountType === DISCOUNT_FIXED) {
    if (!isWholeNumber(amount, 1)) {
      throw promoCodeError(400, 'invalid-amount');
    }
    Object.assign(values, { discountType, amount, currency, percentage: null });
  } else {
    throw promoCodeError(400, 'invalid-discount-type');
  }

  if (maxUses !== null && !isWholeNumber(maxUses, 1)) {
    throw promoCodeError(400, 'invalid-max-uses');
  }
  values.maxUses = maxUses;

  if (expiresAt !== null) {
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) {
      throw promoCodeError(400, 'invalid-expiry');
    }
    values.expiresAt = date;
  } else {
    values.expiresAt = null;
  }

  if (typeof active !== 'boolean') {
    throw promoCodeError(400, 'invalid-active');
  }
  values.active = active;
  return values;
};

const promoCodeRef = id => {
  // Ids from requests are checked, so that they can't point to another document path
  if (typeof id !== 'string' || !isValidCode(id)) {
    throw promoCodeError(404, 'not-found');
  }
  return getFirestore()
    .collection(COLLECTION)
    .doc(id);
};

/**
 * All promo codes, newest first.
 *
 * @returns {Promise<Array<Object>>}
 */
const listPromoCodes = async () => {
  const snapshot = await getFirestore()
    .collection(COLLECTION)
    .get();
  return snapshot.docs.map(serializePromoCode).sort((a, b) => b.createdAt - a.createdAt);
};

/**
 * Create a promo code. Fails with 409 'code-exists' if it exists already.
 *
 * @param {string} adminId
 * @param {Object} input
 * @param {Object} options See validatePromoCodeInput
 * @returns {Promise<Object>} The created promo code
 */
const createPromoCode = async (adminId, input, options) => {
  const values = validatePromoCodeInput(input, { ...options, isNew: true });
  const ref = promoCodeRef(values.code);
  try {
    await ref.create({
      ...values,
      usesCount: 0,
      createdById: adminId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    // gRPC ALREADY_EXISTS
    if (e.code === 6) {
      throw promoCodeError(409, 'code-exists');
    }
    throw e;
  }
  return serializePromoCode(await ref.get());
};

const getExistingPromoCode = async id => {
  const ref = promoCodeRef(id);
  const doc = await ref.get();
  if (!doc.exists) {
    throw promoCodeError(404, 'not-found');
  }
  return { ref, data: doc.data() };
};

/**
 * Update a promo code. The code itself can't change. Once it has been used, the discount can't
 * change either (only the status, usage limit and expiry).
 *
 * @param {string} id
 * @param {Object} input
 * @param {Object} options See validatePromoCodeInput
 * @returns {Promise<Object>} The updated promo code
 */
const updatePromoCode = async (id, input, options) => {
  const { ref, data } = await getExistingPromoCode(id);
  const usesCount = data.usesCount || 0;
  const changesDiscount =
    input?.discountType !== data.discountType ||
    (input?.percentage ?? null) !== (data.percentage ?? null) ||
    (input?.amount ?? null) !== (data.amount ?? null);

  // A used code keeps its discount, even if the commission has changed since
  const values =
    usesCount > 0 && !changesDiscount
      ? validatePromoCodeInput(input, {
          ...options,
          maxPercentage: Math.max(options.maxPercentage, data.percentage || 0),
          currency: data.currency || options.currency,
        })
      : validatePromoCodeInput(input, options);
  if (usesCount > 0 && changesDiscount) {
    throw promoCodeError(409, 'code-in-use');
  }
  if (values.maxUses !== null && values.maxUses < usesCount) {
    throw promoCodeError(400, 'max-uses-below-uses');
  }
  await ref.update({ ...values, updatedAt: FieldValue.serverTimestamp() });
  return serializePromoCode(await ref.get());
};

/**
 * Delete a promo code that hasn't been used (409 'code-in-use' otherwise: deactivate it).
 *
 * @param {string} id
 */
const deletePromoCode = async id => {
  const { ref, data } = await getExistingPromoCode(id);
  if ((data.usesCount || 0) > 0) {
    throw promoCodeError(409, 'code-in-use');
  }
  // With its use history (subcollections aren't deleted with the document)
  await getFirestore().recursiveDelete(ref);
};

module.exports = {
  COLLECTION,
  MARKETPLACE_CURRENCY,
  DISCOUNT_FIXED,
  DISCOUNT_PERCENTAGE,
  createPromoCode,
  deletePromoCode,
  isValidCode,
  listPromoCodes,
  normalizeCode,
  promoCodeRef,
  serializePromoCode,
  updatePromoCode,
  validatePromoCodeInput,
};
