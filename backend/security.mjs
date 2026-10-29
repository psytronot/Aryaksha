const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_MAX_CLIENTS = 10_000;

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy-Report-Only', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://celestrak.org",
    "worker-src 'self' blob:"
  ].join('; '));
  next();
}

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  maxClients = DEFAULT_MAX_CLIENTS,
  now = Date.now
} = {}) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError('windowMs must be positive.');
  if (!Number.isInteger(maxRequests) || maxRequests < 1) throw new RangeError('maxRequests must be a positive integer.');
  if (!Number.isInteger(maxClients) || maxClients < 1) throw new RangeError('maxClients must be a positive integer.');

  const clients = new Map();

  return (req, res, next) => {
    const currentTime = now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown');

    if (clients.size >= maxClients && !clients.has(key)) {
      for (const [clientKey, entry] of clients) {
        if (currentTime - entry.windowStartedAt >= windowMs) clients.delete(clientKey);
        if (clients.size < maxClients) break;
      }
      if (clients.size >= maxClients) {
        const oldestKey = clients.keys().next().value;
        if (oldestKey !== undefined) clients.delete(oldestKey);
      }
    }

    let entry = clients.get(key);
    if (!entry || currentTime - entry.windowStartedAt >= windowMs) {
      entry = { windowStartedAt: currentTime, count: 0 };
      clients.set(key, entry);
    }

    entry.count += 1;
    const remainingSeconds = Math.max(0, Math.ceil((entry.windowStartedAt + windowMs - currentTime) / 1000));
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(remainingSeconds));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(Math.max(1, remainingSeconds)));
      return res.status(429).json({ error: 'Rate limit exceeded. Retry after the reset window.' });
    }

    return next();
  };
}
