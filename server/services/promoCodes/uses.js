const { FieldValue, getFirestore } = require('../firebase');
const { promoCodeRef } = require('./codes');

/**
 * Uses of promo codes, in Firestore:
 *
 *   promoCodes/{CODE}/redemptions/{redemptionId}
 *     { status: 'reserved' | 'used' | 'returned', transactionId, listingId, discount, currency }
 *
 *   promoCodes/{CODE}/ledger/{redemptionId}_{type}   (the code's history, only ever added to)
 *     { type: 'used' | 'returned', transactionId, discount, currency, transition, createdAt }
 *
 * A use is reserved before the order is placed (that enforces the usage limit), linked to the
 * transaction when it's placed ('used' entry), and given back if the order later doesn't go
 * ahead ('returned' entry, see orderEvents.js). Entry ids come from the use, so the same entry is
 * never written twice.
 */

const REDEMPTIONS = 'redemptions';
const LEDGER = 'ledger';
const LEDGER_USED = 'used';
const LEDGER_RETURNED = 'returned';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Where the reading of transaction events got to (see orderEvents.js)
const syncRef = () =>
  getFirestore()
    .collection('promoCodeSync')
    .doc('transactionEvents');

// Note: keep the codes in sync with src/containers/CheckoutPage/PromoCodeField
const checkoutError = code => {
  const error = new Error(code);
  error.status = 400;
  error.statusText = code;
  error.data = { code };
  return error;
};

/**
 * Why the code can't be used now, or null.
 *
 * @param {Object|null} data Promo code document data
 * @param {Date} now
 * @returns {string|null} e.g. 'promo-code-expired'
 */
const getUnusableReason = (data, now) => {
  if (!data || data.active === false) {
    return 'promo-code-invalid';
  }
  const expiresAt = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : data.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= now.getTime()) {
    return 'promo-code-expired';
  }
  if (data.maxUses != null && (data.usesCount || 0) >= data.maxUses) {
    return 'promo-code-used-up';
  }
  return null;
};

const getRefs = (promoCodeId, redemptionId) => {
  if (typeof redemptionId !== 'string' || !UUID_PATTERN.test(redemptionId)) {
    throw new Error('Invalid promo code use id');
  }
  const codeRef = promoCodeRef(promoCodeId);
  return {
    codeRef,
    redemptionRef: codeRef.collection(REDEMPTIONS).doc(redemptionId),
    ledgerRef: type => codeRef.collection(LEDGER).doc(`${redemptionId}_${type}`),
  };
};

const ledgerEntry = (type, use, extra = {}) => ({
  type,
  transactionId: use.transactionId || null,
  discount: use.discount ?? null,
  currency: use.currency || null,
  ...extra,
  createdAt: FieldValue.serverTimestamp(),
});

/**
 * Reserve a use before the order is placed. In one Firestore transaction the code is checked
 * again and its use count increased, so the usage limit holds even when customers check out at
 * the same time.
 *
 * @param {Object} promoCode { id, redemptionId }
 * @param {Object} details Stored with the use (listingId, discount, currency...)
 * @param {Date} [now]
 */
const reserveUse = (promoCode, details, now = new Date()) => {
  const { codeRef, redemptionRef } = getRefs(promoCode.id, promoCode.redemptionId);
  return getFirestore().runTransaction(async t => {
    const doc = await t.get(codeRef);
    const reason = getUnusableReason(doc.exists ? doc.data() : null, now);
    if (reason) {
      throw checkoutError(reason);
    }
    t.update(codeRef, { usesCount: FieldValue.increment(1) });
    t.set(redemptionRef, {
      ...details,
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
    });
  });
};

/**
 * The order wasn't placed: the reserved use is given back (no history entry, as it was never
 * used).
 *
 * @param {Object} promoCode { id, redemptionId }
 */
const releaseUse = promoCode => {
  const { codeRef, redemptionRef } = getRefs(promoCode.id, promoCode.redemptionId);
  return getFirestore().runTransaction(async t => {
    const redemption = await t.get(redemptionRef);
    if (redemption.exists && redemption.data().status === 'reserved') {
      t.update(codeRef, { usesCount: FieldValue.increment(-1) });
      t.delete(redemptionRef);
    }
  });
};

/**
 * The order was placed: the use is linked to the transaction, and a 'used' entry is added to
 * the code's history. Does nothing if it's done already.
 *
 * @param {Object} promoCode { id, redemptionId }
 * @param {string} transactionId
 */
const confirmUse = (promoCode, transactionId) => {
  const { redemptionRef, ledgerRef } = getRefs(promoCode.id, promoCode.redemptionId);
  return getFirestore().runTransaction(async t => {
    const redemption = await t.get(redemptionRef);
    if (!redemption.exists || redemption.data().status !== 'reserved') {
      return;
    }
    t.update(redemptionRef, {
      status: 'used',
      transactionId,
      usedAt: FieldValue.serverTimestamp(),
    });
    t.set(
      ledgerRef(LEDGER_USED),
      ledgerEntry(LEDGER_USED, { ...redemption.data(), transactionId })
    );
  });
};

/**
 * The order didn't go ahead (declined, expired or cancelled): the use is given back, and a
 * 'returned' entry is added to the code's history. Only the order that made the use can give it
 * back, and only once.
 *
 * @param {Object} params
 * @param {string} params.promoCodeId
 * @param {string} params.redemptionId
 * @param {string} params.transactionId Must be the order the use was linked to
 * @param {string} [params.transition] What ended the order, e.g. 'transition/provider-decline-order'
 * @returns {Promise<boolean>} Whether the use was given back now
 */
const returnUse = ({ promoCodeId, redemptionId, transactionId, transition }) => {
  const { codeRef, redemptionRef, ledgerRef } = getRefs(promoCodeId, redemptionId);
  return getFirestore().runTransaction(async t => {
    const [code, redemption] = [await t.get(codeRef), await t.get(redemptionRef)];
    const use = redemption.exists ? redemption.data() : {};
    if (use.status !== 'used' || use.transactionId !== transactionId) {
      return false;
    }
    if (code.exists) {
      t.update(codeRef, { usesCount: FieldValue.increment(-1) });
    }
    t.update(redemptionRef, {
      status: 'returned',
      returnedAt: FieldValue.serverTimestamp(),
      transition: transition || null,
    });
    t.set(
      ledgerRef(LEDGER_RETURNED),
      ledgerEntry(LEDGER_RETURNED, use, { transition: transition || null })
    );
    return true;
  });
};

/**
 * The history of a promo code (newest first, at most 100 entries): uses, and uses given back
 * when the order didn't go ahead.
 *
 * @param {string} promoCodeId
 * @returns {Promise<Array<Object>>}
 */
const listPromoCodeHistory = async promoCodeId => {
  const codeRef = promoCodeRef(promoCodeId);
  const snapshot = await codeRef
    .collection(LEDGER)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  const toMillis = value => (value?.toMillis ? value.toMillis() : value || null);
  return snapshot.docs.map(doc => {
    const { type, transactionId, discount, currency, transition, createdAt } = doc.data();
    return {
      id: doc.id,
      type,
      transactionId: transactionId || null,
      discount: discount ?? null,
      currency: currency || null,
      transition: transition || null,
      createdAt: toMillis(createdAt),
    };
  });
};

/**
 * The sequence id of the last transaction event read, or null before the first read.
 *
 * @returns {Promise<number|null>}
 */
const getSyncPosition = async () => {
  const doc = await syncRef().get();
  return doc.exists ? doc.data().lastSequenceId ?? null : null;
};

/**
 * @param {number} lastSequenceId
 */
const setSyncPosition = lastSequenceId => syncRef().set({ lastSequenceId }, { merge: true });

module.exports = {
  LEDGER_RETURNED,
  LEDGER_USED,
  checkoutError,
  confirmUse,
  getSyncPosition,
  getUnusableReason,
  listPromoCodeHistory,
  releaseUse,
  reserveUse,
  returnUse,
  setSyncPosition,
};
