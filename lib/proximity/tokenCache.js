/**
 * In-memory-only cache of observed BLE tokens.
 * Never persisted to disk, AsyncStorage, or analytics.
 */

const seen = new Map();

export function purgeExpiredTokens(ttlMs) {
  const now = Date.now();
  for (const [token, lastSeenAt] of seen.entries()) {
    if (now - lastSeenAt > ttlMs) {
      seen.delete(token);
    }
  }
}

export function recordSeenToken(token) {
  if (!token || typeof token !== 'string') return;
  seen.set(token, Date.now());
}

export function getRecentTokens(ttlMs) {
  purgeExpiredTokens(ttlMs);
  return [...seen.keys()];
}

export function clearTokenCache() {
  seen.clear();
}

export function getTokenCacheSize() {
  return seen.size;
}
