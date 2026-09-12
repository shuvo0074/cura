export function errorHandler(err, _req, res, _next) {
  if (err.code === '23505') {
    return res.status(409).json({ error: 'That slot was just booked. Please pick another.' });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
