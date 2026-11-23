const { fetchCommission, getSdk, handleError } = require('../api-util/sdk');
const { assertAdmin } = require('../services/users');
const {
  MARKETPLACE_CURRENCY,
  createPromoCode,
  deletePromoCode,
  getMaxPromoPercentage,
  listPromoCodeHistory,
  listPromoCodes,
  updatePromoCode,
} = require('../services/promoCodes');

/**
 * Promo codes for Reveevo's admins (users with profile.metadata.isAdmin). Every request checks
 * that the user is an admin.
 *
 *   GET    /api/admin/promo-codes       → { data: { promoCodes, maxPercentage, currency } }
 *   POST   /api/admin/promo-codes       → { data: promoCode }
 *   PATCH  /api/admin/promo-codes/:id   → { data: promoCode }
 *   DELETE /api/admin/promo-codes/:id   → { data: { id } }
 *   GET    /api/admin/promo-codes/:id/history → { data: { history } }
 */

// A promo code can't give away more than Reveevo's commission (provider + customer %)
const getCodeOptions = async sdk => {
  const response = await fetchCommission(sdk);
  const asset = response?.data?.data?.[0];
  const { providerCommission, customerCommission } =
    asset?.type === 'jsonAsset' ? asset.attributes.data : {};
  return {
    maxPercentage: getMaxPromoPercentage(providerCommission, customerCommission),
    currency: MARKETPLACE_CURRENCY,
  };
};

const respond = (res, data) => res.status(200).json({ data });
const onError = res => e => handleError(res, e, { skipErrorLogging: e?.status && e.status < 500 });

const list = async (req, res) => {
  try {
    const sdk = getSdk(req, res);
    await assertAdmin(sdk);
    const [promoCodes, options] = await Promise.all([listPromoCodes(), getCodeOptions(sdk)]);
    respond(res, { promoCodes, ...options });
  } catch (e) {
    onError(res)(e);
  }
};

const create = async (req, res) => {
  try {
    const sdk = getSdk(req, res);
    const adminId = await assertAdmin(sdk);
    respond(res, await createPromoCode(adminId, req.body, await getCodeOptions(sdk)));
  } catch (e) {
    onError(res)(e);
  }
};

const update = async (req, res) => {
  try {
    const sdk = getSdk(req, res);
    await assertAdmin(sdk);
    respond(res, await updatePromoCode(req.params.id, req.body, await getCodeOptions(sdk)));
  } catch (e) {
    onError(res)(e);
  }
};

const remove = async (req, res) => {
  try {
    const sdk = getSdk(req, res);
    await assertAdmin(sdk);
    await deletePromoCode(req.params.id);
    respond(res, { id: req.params.id });
  } catch (e) {
    onError(res)(e);
  }
};

// Uses of the code, and uses given back when the order didn't go ahead
const history = async (req, res) => {
  try {
    await assertAdmin(getSdk(req, res));
    respond(res, { history: await listPromoCodeHistory(req.params.id) });
  } catch (e) {
    onError(res)(e);
  }
};

module.exports = { list, create, update, remove, history };
