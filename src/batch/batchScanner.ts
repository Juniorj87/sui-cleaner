/**
 * Batch scan engine — sequential queue with limited concurrency, retry with
 * backoff, cancellation with partial results. NEVER Promise.all(100).
 *
 * One failed wallet never stops the rest: failures are captured as
 * `{ status: "failed", error }` rows in input order.
 *
 * The scan function is injectable so the whole TEST matrix (1/10/100
 * wallets, single failure, flaky retry, cancel-halfway) runs offline.
 * Production passes `scanWalletReadonly` — same classifier as single scan.
 */

import type { ScanResult } from "../scanner/walletScanner";
import type { WalletObject } from "../scanner/objectClassifier";
import { isCleanableTarget } from "../lib/walletGroups";
import {
  ZERO_BREAKDOWN,
  type EstimateSource,
  type MechanismBreakdown,
  type WalletEstimate,
} from "./rebateEstimate";

export type BatchRowStatus = "ready" | "failed";

export interface BatchWalletResult {
  address: string;
  label: string;
  status: BatchRowStatus;
  objects: number;
  safe: number;
  review: number;
  keep: number;
  /** ESTIMATED storage rebate (SUI) — dry-run simulation, never a promise */
  rebate: number;
  /** where the estimate came from (simulation / object / unavailable) */
  source: EstimateSource;
  /** per-mechanism executed truth for the estimate */
  breakdown: MechanismBreakdown;
  error?: string;
  scanTimeMs: number;
}

export interface BatchProgress {
  total: number;
  done: number;
  ok: number;
  failed: number;
  remaining: number;
}

export type BatchScanFn = (address: string) => Promise<ScanResult>;

export interface BatchRunOptions {
  /** worker count, default 5 */
  concurrency?: number;
  /** total attempts per wallet (1 = no retry), default 3 */
  maxAttempts?: number;
  /** base backoff ms between attempts (× attempt index), default 400 */
  backoffMs?: number;
  /** extra wait after a rate-limit failure, default 1500 */
  rateLimitBackoffMs?: number;
  onProgress?: (p: BatchProgress) => void;
  /**
   * per settled wallet (full ScanResult) — lets the app cache objects for
   * instant VIEW WALLET without a second RPC scan of the same wallet
   */
  onWallet?: (address: string, scan: ScanResult) => void;
  /**
   * rebate estimator. Production passes a dry-run closure over the app RPC
   * client (same builder + dry-run source as single-wallet review).
   * Absent → every estimate is honestly "unavailable", never invented.
   */
  estimateFn?: (address: string, targets: WalletObject[]) => Promise<WalletEstimate>;
  /** polled between wallets; in-flight wallets finish, rest are skipped */
  isCancelled?: () => boolean;
}

const DEFAULTS = { concurrency: 5, maxAttempts: 3, backoffMs: 400, rateLimitBackoffMs: 1500 };

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(e: unknown): boolean {
  if (e instanceof Error && "code" in e && (e as { code?: string }).code === "rate-limited") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /429|rate.?limit|RESOURCE_EXHAUSTED|quota/i.test(msg);
}

function countBuckets(objects: WalletObject[]): { safe: number; review: number; keep: number } {
  let safe = 0;
  let review = 0;
  let keep = 0;
  for (const o of objects) {
    switch (o.classification) {
      case "cleanable": safe += 1; break;
      case "review":
      case "suspicious": review += 1; break;
      default: keep += 1; break;
    }
  }
  return { safe, review, keep };
}

const UNAVAILABLE_ESTIMATE: WalletEstimate = {
  rebateSui: 0,
  source: "unavailable",
  breakdown: { ...ZERO_BREAKDOWN },
};

async function estimateSafely(
  estimateFn: BatchRunOptions["estimateFn"],
  address: string,
  targets: WalletObject[]
): Promise<WalletEstimate> {
  if (!estimateFn) return { ...UNAVAILABLE_ESTIMATE, breakdown: { ...ZERO_BREAKDOWN } };
  try {
    return await estimateFn(address, targets);
  } catch {
    return {
      rebateSui: 0,
      source: "unavailable",
      breakdown: { ...ZERO_BREAKDOWN, unsupported: targets.length },
    };
  }
}

export async function runBatchScan(
  items: Array<{ address: string; label?: string }>,
  scanFn: BatchScanFn,
  opts: BatchRunOptions = {}
): Promise<BatchWalletResult[]> {
  const cfg = { ...DEFAULTS, ...opts };
  const total = items.length;
  const out: BatchWalletResult[] = new Array(total);
  let done = 0;
  let ok = 0;
  let failed = 0;
  let cursor = 0;

  const emit = () => {
    opts.onProgress?.({ total, done, ok, failed, remaining: total - done });
  };
  emit();

  async function runOne(index: number): Promise<void> {
    const { address, label } = items[index];
    const displayLabel = label ?? "—";
    const startedAll = Date.now();
    let lastError: unknown = new Error("cancelled");
    for (let attemptNo = 1; attemptNo <= cfg.maxAttempts; attemptNo++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const scan = await scanFn(address);
        // Estimate on the SAME auto-eligible set single-wallet review would
        // clean — but estimate failure must not fail the scanned row.
        const targets = scan.objects.filter(isCleanableTarget);
        // eslint-disable-next-line no-await-in-loop
        const est = await estimateSafely(opts.estimateFn, address, targets);
        const counts = countBuckets(scan.objects);
        out[index] = {
          address,
          label: displayLabel,
          status: "ready",
          objects: scan.objects.length,
          ...counts,
          rebate: est.rebateSui,
          source: est.source,
          breakdown: est.breakdown,
          scanTimeMs: Date.now() - startedAll,
        };
        try {
          opts.onWallet?.(address, scan);
        } catch {
          /* cache hook must never break the run */
        }
        ok += 1;
        done += 1;
        emit();
        return;
      } catch (e) {
        lastError = e;
        if (attemptNo >= cfg.maxAttempts) break;
        // eslint-disable-next-line no-await-in-loop
        await sleep(cfg.backoffMs * attemptNo + (isRateLimit(e) ? cfg.rateLimitBackoffMs : 0));
      }
    }
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    out[index] = {
      address,
      label: displayLabel,
      status: "failed",
      objects: 0, safe: 0, review: 0, keep: 0, rebate: 0,
      source: "unavailable",
      breakdown: { ...ZERO_BREAKDOWN },
      error: msg.slice(0, 160),
      scanTimeMs: Date.now() - startedAll,
    };
    failed += 1;
    done += 1;
    emit();
  }

  const workers: Array<Promise<void>> = [];
  const lanes = total === 0 ? 0 : Math.max(1, Math.min(cfg.concurrency, total));
  for (let w = 0; w < lanes; w++) {
    workers.push(
      (async () => {
        for (;;) {
          if (opts.isCancelled?.()) return;
          const index = cursor;
          if (index >= total) return;
          cursor += 1;
          // eslint-disable-next-line no-await-in-loop
          await runOne(index);
        }
      })()
    );
  }
  await Promise.all(workers);

  // Cancelled tail: rows never started keep input order as failed-cancelled.
  for (let i = 0; i < total; i++) {
    if (!out[i]) {
      out[i] = {
        address: items[i].address,
        label: items[i].label ?? "—",
        status: "failed",
        objects: 0, safe: 0, review: 0, keep: 0, rebate: 0,
        source: "unavailable",
        breakdown: { ...ZERO_BREAKDOWN },
        error: "Cancelled before scan started.",
        scanTimeMs: 0,
      };
    }
  }
  return out;
}
