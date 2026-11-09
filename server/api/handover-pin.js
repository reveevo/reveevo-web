const { getSdk, handleError } = require('../api-util/sdk');
const { getPinForCustomer } = require('../services/handover');

/**
 * Returns the hand-over PIN of a transaction to its customer.
 *
 * Request body: { transactionId }
 * Response: { data: { pin } }
 */
module.exports = async (req, res) => {
  const { transactionId } = req.body || {};
  if (typeof transactionId !== 'string') {
    return res.status(400).json({ error: 'transactionId is required' });
  }
  try {
    const result = await getPinForCustomer(getSdk(req, res), transactionId);
    res.status(200).json({ data: result });
  } catch (e) {
    handleError(res, e);
  }
};
