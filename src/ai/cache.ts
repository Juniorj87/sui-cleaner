/**
 * AI Analysis Cache — localStorage-based.
 *
 * Cache key: objectId + network + digest/version
 * If digest/version changes, the cached analysis is invalidated.
 * Model name is included so provider/model upgrades re-analyze.
 */

import type { AIAnalysis, AICacheEntry } from "./provider";

const CACHE_PREFIX = "sc_ai_cache_";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 500;

function cacheKey(objectId: string, network: string): string {
  return `${CACHE_PREFIX}${objectId}_${network}`;
}

/** Get a cached analysis if valid (digest/version match, not expired) */
export function getCachedAnalysis(
  objectId: string,
  network: string,
  digest?: string,
  version?: string,
  model?: string
): AIAnalysis | null {
  try {
    const raw = localStorage.getItem(cacheKey(objectId, network));
    if (!raw) return null;
    const entry: AICacheEntry = JSON.parse(raw);

    // Invalidate if digest or version changed
    if (digest && entry.digest && digest !== entry.digest) {
      localStorage.removeItem(cacheKey(objectId, network));
      return null;
    }
    if (version && entry.version && version !== entry.version) {
      localStorage.removeItem(cacheKey(objectId, network));
      return null;
    }

    // Invalidate if expired
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(objectId, network));
      return null;
    }

    // Invalidate if model changed
    if (model && entry.model && model !== entry.model) {
      return null; // don't remove — let the new model re-analyze
    }

    return entry.analysis;
  } catch {
    return null;
  }
}

/** Store an analysis result in cache */
export function setCachedAnalysis(
  objectId: string,
  network: string,
  analysis: AIAnalysis,
  digest?: string,
  version?: string,
  model?: string
): void {
  try {
    const entry: AICacheEntry = {
      objectId,
      network,
      digest,
      version,
      analysis,
      timestamp: Date.now(),
      model: model ?? "unknown",
    };
    localStorage.setItem(cacheKey(objectId, network), JSON.stringify(entry));
    evictOldEntries();
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/** Remove cached analysis for a specific object */
export function removeCachedAnalysis(objectId: string, network: string): void {
  try {
    localStorage.removeItem(cacheKey(objectId, network));
  } catch {
    // ignore
  }
}

/** Clear all cached AI analyses */
export function clearAllCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Evict oldest entries if cache exceeds limit */
function evictOldEntries(): void {
  try {
    const entries: Array<{ key: string; timestamp: number }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const entry: AICacheEntry = JSON.parse(raw);
            entries.push({ key: k, timestamp: entry.timestamp });
          }
        } catch {
          // corrupted entry — remove it
          localStorage.removeItem(k);
        }
      }
    }
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = entries.slice(0, entries.length - MAX_CACHE_ENTRIES);
      toRemove.forEach((e) => localStorage.removeItem(e.key));
    }
  } catch {
    // ignore
  }
}

/** Count cached entries (for UI display) */
export function cacheSize(): number {
  let count = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) count++;
    }
  } catch {
    // ignore
  }
  return count;
}
