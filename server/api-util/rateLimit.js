/**
 * A small in-memory rate limit (per server process), as Express middleware. Requests over the
 * limit get 429 with statusText 'too-many-requests'.
 *
 * @param {Object} options
 * @param {number} options.windowMs Length of the window
 * @param {number} options.max Requests allowed per key in a window
 * @param {Function} [options.keyFn] (req) => key, the client's IP address by default
 * @param {Function} [options.skip] (req) => true to not count the request
 * @returns {Function} middleware
 */
const createRateLimit = ({ windowMs, max, keyFn = req => req.ip, skip = () => false }) => {
  const hits = new Map();

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }
    const now = Date.now();
    // Expired windows are dropped as requests come in, so the map stays small
    if (hits.size > 10000) {
      hits.forEach((entry, key) => (entry.resetAt <= now ? hits.delete(key) : null));
    }
    const key = keyFn(req);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({
        name: 'LocalAPIError',
        message: 'Too many requests',
        status: 429,
        statusText: 'too-many-requests',
        data: { code: 'too-many-requests' },
      });
    }
    return next();
  };
};

module.exports = { createRateLimit };
