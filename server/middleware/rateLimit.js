// In-memory fixed-window limiter. Enough for a single API process; move the
// counters to Redis or Postgres before running more than one instance.
const buckets = new Map();

function hit(key, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b;
}

// Drop expired windows so the map doesn't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref();

function tooMany(res, resetAt) {
  res.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
  return res.status(429).json({ error: 'Too many attempts. Please try again later.', code: 'RATE_LIMITED' });
}

// Limits requests per client IP.
export function limitByIp(name, { max, windowMs }) {
  return (req, res, next) => {
    const b = hit(`${name}:ip:${req.ip}`, windowMs);
    if (b.count > max) return tooMany(res, b.resetAt);
    next();
  };
}

// Per-account limit (email or phone), counted by the controller so that
// only the attempts that matter count, e.g. failed logins.
export function accountLimiter(name, { max, windowMs }) {
  return {
    blocked(id) {
      const b = buckets.get(`${name}:${id}`);
      return b && b.resetAt > Date.now() && b.count >= max ? b : null;
    },
    record(id) { hit(`${name}:${id}`, windowMs); },
    reset(id) { buckets.delete(`${name}:${id}`); },
    tooMany,
  };
}

export function _resetAllLimits() { buckets.clear(); }
