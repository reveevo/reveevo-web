const { getSdk, handleError } = require('../api-util/sdk');
const { confirmHandover } = require('../services/handover');

// Logged in user's id, or null (Reveevo's courier confirms deliveries without logging in).
const getCurrentUserIdMaybe = sdk =>
  sdk.currentUser
    .show()
    .then(response => response.data.data.id.uuid)
    .catch(() => null);

/**
 * Confirms the hand-over of an order with the customer's PIN.
 *
 * Request body: { transactionId, pin }
 * Response: { data: { transition } }
 */
module.exports = async (req, res) => {
  const { transactionId, pin } = req.body || {};
  if (typeof transactionId !== 'string' || typeof pin !== 'string') {
    return res.status(400).json({ error: 'transactionId and pin are required' });
  }
  try {
    const currentUserId = await getCurrentUserIdMaybe(getSdk(req, res));
    const result = await confirmHandover({ transactionId, pin, currentUserId });
    res.status(200).json({ data: result });
  } catch (e) {
    handleError(res, e, { skipErrorLogging: e?.status && e.status < 500 });
  }
};
