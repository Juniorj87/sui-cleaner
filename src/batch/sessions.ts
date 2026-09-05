/**
 * Wallet sessions + recent scans.
 *
 * Every scan binds `walletAddress + scanSessionId` so results can never leak
 * across wallets (TEST 10/11/12). Recent scans persist SAFE metadata only —
 * never keys, seeds, or credentials.
 */

export interface ScanSession {
  id: string;
  address: string;
  label?: string;
  startedAt: number;
}

export function createSession(address: string, label?: string): ScanSession {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return { id: `${Date.now().toString(36)}-${rand}`, address, label, startedAt: Date.now() };
}

export interface RecentScan {
  address: string;
  label: string;
  scannedAt: number;
  total: number;
  safe: number;
  review: number;
  keep: number;
  rebate: number;
}

const STORAGE_KEY = "sc_recent_scans";
const MAX_RECENTS = 10;

export function loadRecents(): RecentScan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is RecentScan => !!r && typeof (r as RecentScan).address === "string")
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function addRecent(meta: RecentScan): RecentScan[] {
  const rest = loadRecents().filter((r) => r.address.toLowerCase() !== meta.address.toLowerCase());
  const next = [meta, ...rest].slice(0, MAX_RECENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota/full — recents are best-effort */
  }
  return next;
}

/**
 * Explicit back navigation (never browser history, never an automatic
 * re-scan — returning only changes the screen).
 */
export type BackTarget = "home" | "batch" | "batch-results";

export function resolveBackTarget(
  current: "report" | "explore" | "batch" | "batch-results",
  returnTo: "batch" | null,
  hasBatchResults: boolean
): BackTarget {
  if (current === "batch-results") return "batch";
  if (current === "batch") return "home";
  if (returnTo === "batch") return hasBatchResults ? "batch-results" : "home";
  return "home";
}

/** "2 hours ago" style relative time for the RESCAN affordance. */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
