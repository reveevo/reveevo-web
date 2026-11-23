const { getSdk, handleError, serialize } = require('../api-util/sdk');
const { returnPromoCodeUseMaybe } = require('../services/promoCodes');

const DECLINE_ORDER_TRANSITION = 'transition/provider-decline-order';

/**
 * The provider declines an order (default-purchase process). The buyer is refunded by the
 * transaction process, and the promo code use (if any) is given back here.
 *
 * Request body: { transactionId, queryParams }
 * Response: the transition response (like transition-privileged)
 */
module.exports = async (req, res) => {
  const { transactionId, queryParams } = req.body || {};
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  try {
    // The provider's own SDK: Marketplace API checks that they can make this transition.
    const apiResponse = await getSdk(req, res).transactions.transition(
      { id: transactionId, transition: DECLINE_ORDER_TRANSITION, params: {} },
      { ...queryParams, expand: true }
    );

    // The order is declined even if giving the use back fails (it's logged)
    await returnPromoCodeUseMaybe(apiResponse.data.data, DECLINE_ORDER_TRANSITION).catch(e =>
      console.error('Failed to return the promo code use', e)
    );

    const { status, statusText, data } = apiResponse;
    res
      .status(status)
      .set('Content-Type', 'application/transit+json')
      .send(serialize({ status, statusText, data }))
      .end();
  } catch (e) {
    handleError(res, e);
  }
};
