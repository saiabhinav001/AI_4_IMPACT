const rateLimitStore = globalThis.__registrationApiRateLimitStore || new Map();

if (!globalThis.__registrationApiRateLimitStore) {
  globalThis.__registrationApiRateLimitStore = rateLimitStore;
}

function asTrimmedString(value) {
  return String(value ?? "").trim();
}

export function getClientIp(request) {
  const forwarded = asTrimmedString(request.headers.get("x-forwarded-for"));
  const firstIp = forwarded.split(",")[0].trim();
  return firstIp || "unknown";
}

function pruneExpiredEntries(nowMs, windowMs) {
  if (rateLimitStore.size <= 2048) {
    return;
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (!entry || nowMs - Number(entry.start || 0) >= windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

export function hitRateLimit({ scope, identity, windowMs = 60 * 1000, maxRequests = 5 }) {
  const normalizedScope = asTrimmedString(scope) || "register";
  const normalizedIdentity = asTrimmedString(identity) || "unknown";
  const key = `${normalizedScope}:${normalizedIdentity}`;
  const nowMs = Date.now();

  pruneExpiredEntries(nowMs, windowMs);

  const current = rateLimitStore.get(key);
  if (!current || nowMs - Number(current.start || 0) >= windowMs) {
    rateLimitStore.set(key, { count: 1, start: nowMs });
    return false;
  }

  if (Number(current.count || 0) >= maxRequests) {
    return true;
  }

  current.count = Number(current.count || 0) + 1;
  current.start = Number(current.start || nowMs);
  rateLimitStore.set(key, current);
  return false;
}
