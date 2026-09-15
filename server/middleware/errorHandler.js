import { logger } from '../logger.js';

export function errorHandler(err, req, res, _next) {
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That slot was just booked. Please pick another.' });
  }
  (req.log || logger).error({ err }, 'unhandled error');
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
