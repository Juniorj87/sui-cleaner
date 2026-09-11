/**
 * Local cleanup history — no backend, no database.
 * Stored in localStorage only. Every entry comes from a REAL confirmed
 * transaction result (digest, deleted count, on-chain rebate/net when
 * available). Nothing is ever faked or seeded.
 */

export interface CleanupRecord {
  /** ms epoch */
  date: number;
  /** scanned wallet address (normalized) */
  address: string;
  /** ACTUAL on-chain deleted count (effects), never the pre-sign selection */
  objectsCleaned: number;
  /** real transaction digest */
  digest: string;
  /** actual storage rebate in SUI (effects.gasUsed), when available */
  storageRebateSui?: string;
  /** actual net result in SUI (sender balance change), when available */
  netResultSui?: string;
  /** true for the fictional demo flow */
  demo: boolean;
}

const KEY = "sui-cleaner-cleanup-history-v1";
const MAX_RECORDS = 25;

export function loadCleanupHistory(): CleanupRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (r): r is CleanupRecord =>
          !!r && typeof r === "object" &&
          typeof (r as CleanupRecord).date === "number" &&
          typeof (r as CleanupRecord).address === "string" &&
          typeof (r as CleanupRecord).objectsCleaned === "number" &&
          typeof (r as CleanupRecord).digest === "string"
      )
      .slice(0, MAX_RECORDS);
  } catch {
    return [];
  }
}

export function recordCleanup(entry: CleanupRecord): CleanupRecord[] {
  const list = [entry, ...loadCleanupHistory()].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode) — history simply stays in-memory */
  }
  return list;
}

export function clearCleanupHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
