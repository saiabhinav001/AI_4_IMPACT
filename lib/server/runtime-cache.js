const CACHE_ENTRY_LIMIT = 400;

const runtimeCache = globalThis.__ai4impactRuntimeCache || new Map();
const inflightCache = globalThis.__ai4impactRuntimeCacheInflight || new Map();

if (!globalThis.__ai4impactRuntimeCache) {
  globalThis.__ai4impactRuntimeCache = runtimeCache;
}

if (!globalThis.__ai4impactRuntimeCacheInflight) {
  globalThis.__ai4impactRuntimeCacheInflight = inflightCache;
}

function nowMs() {
  return Date.now();
}

function parseTtlMs(ttlMs, fallbackMs = 0) {
  const numeric = Number(ttlMs);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallbackMs;
  }

  return Math.floor(numeric);
}

function pruneExpiredEntries() {
  const now = nowMs();

  for (const [cacheKey, entry] of runtimeCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      runtimeCache.delete(cacheKey);
    }
  }
}

function enforceEntryLimit() {
  if (runtimeCache.size <= CACHE_ENTRY_LIMIT) {
    return;
  }

  const entries = [...runtimeCache.entries()].sort(
    (entryA, entryB) => Number(entryA[1]?.storedAt || 0) - Number(entryB[1]?.storedAt || 0)
  );

  const removeCount = runtimeCache.size - CACHE_ENTRY_LIMIT;
  for (let index = 0; index < removeCount; index += 1) {
    const entry = entries[index];
    if (entry) {
      runtimeCache.delete(entry[0]);
    }
  }
}

function readFreshEntry(cacheKey) {
  const entry = runtimeCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= nowMs()) {
    runtimeCache.delete(cacheKey);
    return null;
  }

  return entry.value;
}

export async function readThroughRuntimeCache({
  cacheKey,
  ttlMs,
  bypass = false,
  loader,
}) {
  if (typeof loader !== "function") {
    throw new Error("readThroughRuntimeCache requires a loader function.");
  }

  const effectiveTtlMs = parseTtlMs(ttlMs, 0);

  if (!bypass && effectiveTtlMs > 0) {
    const cachedValue = readFreshEntry(cacheKey);
    if (cachedValue !== null) {
      return {
        payload: cachedValue,
        cacheHit: true,
        coalesced: false,
      };
    }
  }

  if (!bypass && inflightCache.has(cacheKey)) {
    const payload = await inflightCache.get(cacheKey);
    return {
      payload,
      cacheHit: false,
      coalesced: true,
    };
  }

  const loadPromise = (async () => {
    const payload = await loader();

    if (effectiveTtlMs > 0) {
      const now = nowMs();
      runtimeCache.set(cacheKey, {
        value: payload,
        storedAt: now,
        expiresAt: now + effectiveTtlMs,
      });

      pruneExpiredEntries();
      enforceEntryLimit();
    }

    return payload;
  })();

  inflightCache.set(cacheKey, loadPromise);

  try {
    const payload = await loadPromise;
    return {
      payload,
      cacheHit: false,
      coalesced: false,
    };
  } finally {
    inflightCache.delete(cacheKey);
  }
}

export function invalidateRuntimeCacheKey(cacheKey) {
  runtimeCache.delete(cacheKey);
  inflightCache.delete(cacheKey);
}

export function invalidateRuntimeCachePrefix(prefix) {
  for (const key of runtimeCache.keys()) {
    if (key.startsWith(prefix)) {
      runtimeCache.delete(key);
    }
  }

  for (const key of inflightCache.keys()) {
    if (key.startsWith(prefix)) {
      inflightCache.delete(key);
    }
  }
}

export function getRuntimeCacheStats() {
  return {
    entries: runtimeCache.size,
    inflight: inflightCache.size,
    limit: CACHE_ENTRY_LIMIT,
  };
}
