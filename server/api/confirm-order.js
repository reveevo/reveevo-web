const { getSdk, handleError, serialize } = require('../api-util/sdk');
const { saveDeliveryLinkMaybe } = require('../services/handover');

const CONFIRM_ORDER_TRANSITION = 'transition/provider-confirm-order';

/**
 * The provider confirms an order (default-purchase process) with the hand-over day.
 * For shipped orders, the courier's delivery link is then saved to the transaction's metadata,
 * so that the operator can copy it from Console.
 *
 * Request body: { transactionId, params: { protectedData }, queryParams }
 * Response: the transition response (like transition-privileged)
 */
module.exports = async (req, res) => {
  const { transactionId, params, queryParams } = req.body || {};
  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  try {
    // The provider's own SDK: Marketplace API checks that they can make this transition.
    const apiResponse = await getSdk(req, res).transactions.transition(
      {
        id: transactionId,
        transition: CONFIRM_ORDER_TRANSITION,
        params: { protectedData: params?.protectedData || {} },
      },
      { ...queryParams, expand: true }
    );

    // The order is confirmed even if saving the link fails (it can be found in Console too).
    await saveDeliveryLinkMaybe(apiResponse.data.data).catch(e =>
      console.error('Failed to save the delivery link', e)
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
