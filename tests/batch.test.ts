// BATCH SCAN test matrix (§29): intake, engine, results, sessions.
// Engine tests inject stub scan functions — fully offline.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MAX_BATCH_WALLETS,
  buildPreview,
  parseAddressText,
  parseCsvText,
  removePreviewEntry,
} from "../src/batch/addresses";
import { runBatchScan, type BatchScanFn } from "../src/batch/batchScanner";
import {
  aggregateBatch,
  batchToCsv,
  filterBatchResults,
  sortBatchResults,
} from "../src/batch/batchResults";
import {
  addRecent,
  createSession,
  loadRecents,
  resolveBackTarget,
  timeAgo,
} from "../src/batch/sessions";
import type { WalletObject } from "../src/scanner/objectClassifier";
import type { ScanResult } from "../src/scanner/walletScanner";

function addr(n: number): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function mkObj(classification: WalletObject["classification"], coinBalance?: string, dust = false): WalletObject {
  return { classification, coinBalance, dust } as WalletObject;
}

function mkScan(objects: WalletObject[]): ScanResult {
  return { source: "onchain", objects, stats: {} as never, condition: 0 };
}

/** stub scan: per-address behavior ("ok" objects | "fail" | "flaky-once") */
function stubScan(
  plan: Record<string, { objects?: WalletObject[]; fail?: string; flaky?: boolean }>,
  calls: string[] = [],
  delayMs = 0
): BatchScanFn {
  const flakySeen = new Set<string>();
  return async (address: string) => {
    calls.push(address);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    const p = plan[address] ?? { objects: [] };
    if (p.flaky && !flakySeen.has(address)) {
      flakySeen.add(address);
      throw new Error("transient RPC hiccup");
    }
    if (p.fail) throw new Error(p.fail);
    return mkScan(p.objects ?? []);
  };
}

const RICH = [
  mkObj("cleanable", "0"),
  mkObj("cleanable", "0"),
  mkObj("cleanable", "5", true),
  mkObj("review"),
  mkObj("suspicious"),
  mkObj("keep"),
  mkObj("protected"),
];

describe("intake: parse / validate / dedupe / cap", () => {
  it("TEST 6: invalid addresses are marked invalid, valid pass", () => {
    const p = buildPreview(parseAddressText(`${addr(1)}\nnot-an-address\n0xZZZ\n${addr(2)}`).map((a) => a));
    expect(p.uploaded).toBe(4);
    expect(p.invalid).toBe(2);
    expect(p.uniqueValid).toBe(2);
    expect(p.entries.filter((e) => e.status === "invalid")).toHaveLength(2);
  });

  it("TEST 5: duplicates counted, first occurrence wins", () => {
    const a1 = addr(1);
    // same address, mixed-case hex body (0x prefix stays lowercase per isSuiAddress)
    const mixed = "0x" + a1.slice(2).toUpperCase();
    const p = buildPreview([{ address: a1 }, { address: mixed }, { address: addr(2) }]);
    expect(p.uploaded).toBe(3);
    expect(p.duplicates).toBe(1);
    expect(p.uniqueValid).toBe(2);
    expect(p.entries[0].status).toBe("ready");
    expect(p.entries[1].status).toBe("duplicate");
  });

  it("spec example shape: 102 up / 3 invalid / 5 dupes → 94 unique", () => {
    const items = Array.from({ length: 94 }, (_, i) => ({ address: addr(i + 1) }));
    for (let i = 0; i < 5; i++) items.push({ address: addr(i + 1) });
    items.push({ address: "junk-1" }, { address: "junk-2" }, { address: "junk-3" });
    const p = buildPreview(items);
    expect(p.uploaded).toBe(102);
    expect(p.invalid).toBe(3);
    expect(p.duplicates).toBe(5);
    expect(p.uniqueValid).toBe(94);
  });

  it("TEST 4: 101 unique valid → overLimit blocks the run", () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ address: addr(i + 1) }));
    const p = buildPreview(items);
    expect(p.uniqueValid).toBe(101);
    expect(p.overLimit).toBe(true);
    expect(MAX_BATCH_WALLETS).toBe(100);
  });

  it("100 unique valid is allowed", () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ address: addr(i + 1) }));
    expect(buildPreview(items).overLimit).toBe(false);
  });

  it("CSV: header mode (address,label) and plain mode", () => {
    const withHeader = parseCsvText("address,label\n0xAAA,Main\n,,\n0xCCC,");
    expect(withHeader.length).toBe(2);
    expect(withHeader[0]).toEqual({ address: "0xAAA", label: "Main" });
    expect(withHeader[1]).toEqual({ address: "0xCCC", label: undefined });
    const walletCol = parseCsvText("wallet,label\n0xAAA,Main");
    expect(walletCol).toEqual([{ address: "0xAAA", label: "Main" }]);
    const plain = parseCsvText(`${addr(1)},My Label\n${addr(2)}`);
    expect(plain).toEqual([
      { address: addr(1), label: "My Label" },
      { address: addr(2), label: undefined },
    ]);
  });

  it("missing label falls back to — and removing a twin promotes the duplicate", () => {
    const a1 = addr(1);
    let p = buildPreview([{ address: a1 }, { address: a1 }]);
    expect(p.entries[0].label).toBe("—");
    p = removePreviewEntry(p, a1, "ready");
    expect(p.uniqueValid).toBe(1);
    expect(p.duplicates).toBe(0);
    expect(p.entries[0].status).toBe("ready");
  });
});

describe("engine: queue / retry / cancel / isolation", () => {
  it("TEST 1: single wallet → one ready result with counts; estimate via injected fn", async () => {
    const calls: string[] = [];
    const out = await runBatchScan(
      [{ address: addr(1), label: "Main" }],
      stubScan({ [addr(1)]: { objects: RICH } }, calls),
      {
        estimateFn: async () => ({
          rebateSui: 0.0042,
          source: "simulation",
          breakdown: { destroyZero: 2, dustMerge: 1, unsupported: 0 },
        }),
      }
    );
    expect(calls).toEqual([addr(1)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      address: addr(1), label: "Main", status: "ready",
      objects: 7, safe: 3, review: 2, keep: 2,
      rebate: 0.0042, source: "simulation",
    });
    expect(out[0].breakdown).toEqual({ destroyZero: 2, dustMerge: 1, unsupported: 0 });
  });

  it("no estimateFn → honestly unavailable, never count × constant", async () => {
    const out = await runBatchScan(
      [{ address: addr(1) }],
      stubScan({ [addr(1)]: { objects: RICH } })
    );
    expect(out[0].status).toBe("ready");
    expect(out[0].rebate).toBe(0);
    expect(out[0].source).toBe("unavailable");
    // NOT 7 × 0.0028 = 0.0196 and NOT 3 × 0.0028 = 0.0084
    expect(out[0].rebate).not.toBeCloseTo(0.0196, 4);
    expect(out[0].rebate).not.toBeCloseTo(0.0084, 4);
  });

  it("TEST 2/3: 10 and 100 wallets → all results in input order", async () => {
    for (const n of [10, 100]) {
      const items = Array.from({ length: n }, (_, i) => ({ address: addr(i + 1) }));
      const plan: Record<string, { objects: WalletObject[] }> = {};
      items.forEach((it, i) => { plan[it.address] = { objects: i % 2 === 0 ? RICH : [] }; });
      const out = await runBatchScan(items, stubScan(plan), { concurrency: 5 });
      expect(out).toHaveLength(n);
      expect(out.map((r) => r.address)).toEqual(items.map((it) => it.address));
      expect(out.filter((r) => r.status === "ready")).toHaveLength(n);
    }
  });

  it("TEST 7: one RPC failure does not stop the other 99", async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ address: addr(i + 1) }));
    const plan: Record<string, { objects?: WalletObject[]; fail?: string }> = {};
    items.forEach((it) => { plan[it.address] = { objects: RICH }; });
    plan[addr(50)] = { fail: "RPC 500: upstream exploded" };
    const out = await runBatchScan(items, stubScan(plan), { concurrency: 8, backoffMs: 1 });
    expect(out.filter((r) => r.status === "ready")).toHaveLength(99);
    expect(out.filter((r) => r.status === "failed")).toHaveLength(1);
    expect(out[49]).toMatchObject({ address: addr(50), status: "failed" });
    expect(out[49].error).toContain("upstream exploded");
  });

  it("TEST 8: flaky-once succeeds via retry; persistent failure exhausts attempts", async () => {
    const calls: string[] = [];
    const ok = await runBatchScan(
      [{ address: addr(1) }],
      stubScan({ [addr(1)]: { objects: RICH, flaky: true } }, calls),
      { backoffMs: 1 }
    );
    expect(ok[0].status).toBe("ready");
    expect(calls.filter((c) => c === addr(1)).length).toBe(2);

    const calls2: string[] = [];
    const bad = await runBatchScan(
      [{ address: addr(2) }],
      stubScan({ [addr(2)]: { fail: "boom" } }, calls2),
      { backoffMs: 1 }
    );
    expect(bad[0].status).toBe("failed");
    expect(calls2.length).toBe(3); // default maxAttempts
  });

  it("TEST 9: cancel halfway keeps partial results in order", async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ address: addr(i + 1) }));
    const plan: Record<string, { objects: WalletObject[] }> = {};
    items.forEach((it) => { plan[it.address] = { objects: RICH }; });
    let settled = 0;
    const out = await runBatchScan(items, stubScan(plan, [], 5), {
      concurrency: 2,
      backoffMs: 1,
      onProgress: (p) => { settled = p.done; },
      isCancelled: () => settled >= 6,
    });
    expect(out).toHaveLength(20);
    const ready = out.filter((r) => r.status === "ready");
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.length).toBeLessThan(20);
    // input order preserved even with cancellation
    expect(out.map((r) => r.address)).toEqual(items.map((it) => it.address));
  });

  it("TEST 12: second run contains no data from the first (session isolation)", async () => {
    const runA = await runBatchScan([{ address: addr(1) }], stubScan({ [addr(1)]: { objects: RICH } }));
    const runB = await runBatchScan([{ address: addr(2) }], stubScan({ [addr(2)]: { objects: [] } }));
    expect(runB[0].objects).toBe(0);
    expect(runB[0].address).toBe(addr(2));
    expect(runA[0].address).toBe(addr(1));
  });

  it("onWallet hook receives full scans for instant VIEW WALLET (no second RPC)", async () => {
    const seen = new Map<string, number>();
    const items = [{ address: addr(1) }, { address: addr(2) }];
    await runBatchScan(
      items,
      stubScan({ [addr(1)]: { objects: RICH }, [addr(2)]: { fail: "x" } }),
      { backoffMs: 1, onWallet: (a, s) => { seen.set(a, s.objects.length); } }
    );
    expect(seen.get(addr(1))).toBe(7);
    expect(seen.has(addr(2))).toBe(false);
  });

  it("progress callback reports done/ok/failed/remaining", async () => {
    const seen: number[] = [];
    const items = [{ address: addr(1) }, { address: addr(2) }, { address: addr(3) }];
    await runBatchScan(
      items,
      stubScan({ [addr(1)]: { objects: RICH }, [addr(2)]: { fail: "x" }, [addr(3)]: { objects: [] } }),
      { backoffMs: 1, onProgress: (p) => seen.push(p.done) }
    );
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(3);
  });
});

describe("results: aggregate / sort / filter / csv", () => {
  const sim = { destroyZero: 1, dustMerge: 0, unsupported: 0 };
  const rows = [
    { address: addr(3), label: "C", status: "ready", objects: 132, safe: 62, review: 10, keep: 60, rebate: 0.42, source: "simulation", breakdown: sim, scanTimeMs: 1 },
    { address: addr(1), label: "A", status: "ready", objects: 291, safe: 194, review: 87, keep: 10, rebate: 0.55, source: "simulation", breakdown: sim, scanTimeMs: 1 },
    { address: addr(2), label: "B", status: "failed", objects: 0, safe: 0, review: 0, keep: 0, rebate: 0, source: "unavailable", breakdown: sim, error: "nope", scanTimeMs: 1 },
    { address: addr(4), label: "D", status: "ready", objects: 84, safe: 0, review: 12, keep: 72, rebate: 0, source: "unavailable", breakdown: sim, scanTimeMs: 1 },
  ] as never;

  it("aggregate sums ready rows; partial-estimate note condition", () => {
    const agg = aggregateBatch(rows as never);
    // counts are exact over all ready rows; rebate only over estimated ones
    expect(agg).toMatchObject({ wallets: 4, objects: 507, safe: 256, review: 109, failed: 1, withEstimate: 2 });
    expect(agg.rebate).toBeCloseTo(0.97, 4);
    expect(agg.withEstimate).toBeLessThan(agg.wallets);
  });

  it("default sort is rebate DESC; keys toggle", () => {
    expect(sortBatchResults(rows as never, "rebate", "desc").map((r) => r.address)).toEqual([addr(1), addr(3), addr(2), addr(4)]);
    expect(sortBatchResults(rows as never, "wallet", "asc").map((r) => r.address)).toEqual([addr(1), addr(2), addr(3), addr(4)]);
    expect(sortBatchResults(rows as never, "objects", "desc")[0].address).toBe(addr(1));
    expect(sortBatchResults(rows as never, "cleanable", "desc")[0].address).toBe(addr(1));
  });

  it("filters: all / cleanable / none / failed", () => {
    expect(filterBatchResults(rows as never, "all")).toHaveLength(4);
    expect(filterBatchResults(rows as never, "cleanable").map((r) => r.address)).toEqual([addr(3), addr(1)]);
    expect(filterBatchResults(rows as never, "none").map((r) => r.address)).toEqual([addr(4)]);
    expect(filterBatchResults(rows as never, "failed").map((r) => r.address)).toEqual([addr(2)]);
  });

  it("CSV has the exact columns and no secrets", () => {
    const csv = batchToCsv(rows as never);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("wallet,label,objects,safe_to_clean,review,keep,estimated_rebate,status");
    expect(lines[1]).toBe(`${addr(3)},C,132,62,10,60,0.4200,ready`);
    expect(lines[3]).toBe(`${addr(2)},B,0,0,0,0,,failed`);
    // unavailable estimate leaves the cell blank instead of a fake 0.0000
    expect(lines[4]).toBe(`${addr(4)},D,84,0,12,72,,ready`);
    expect(csv).not.toMatch(/seed|private|AQ\.|sk-/i);
  });
});

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  });
}

describe("sessions / recents / navigation", () => {
  beforeEach(() => { stubLocalStorage(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("TEST 10: a session binds exactly one address with a unique id", () => {
    const a = createSession(addr(1), "Main");
    const b = createSession(addr(1), "Main");
    expect(a.address).toBe(addr(1));
    expect(a.id).not.toBe(b.id);
  });

  it("recents round-trip with counts; newest first; capped", () => {
    for (let i = 0; i < 12; i++) {
      addRecent({ address: addr(i + 1), label: "—", scannedAt: 1000 + i, total: i, safe: i, review: 0, keep: 0, rebate: 0 });
    }
    const recents = loadRecents();
    expect(recents).toHaveLength(10);
    expect(recents[0].address).toBe(addr(12));
    // re-adding moves to front without duplicating
    addRecent({ address: addr(5), label: "—", scannedAt: 9999, total: 1, safe: 1, review: 0, keep: 0, rebate: 0 });
    expect(loadRecents()[0].address).toBe(addr(5));
    expect(loadRecents().filter((r) => r.address === addr(5))).toHaveLength(1);
  });

  it("timeAgo labels for the RESCAN affordance", () => {
    const now = 10_000_000;
    expect(timeAgo(now - 10_000, now)).toBe("just now");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(timeAgo(now - 2 * 3600_000, now)).toBe("2 hours ago");
    expect(timeAgo(now - 3 * 86400_000, now)).toBe("3 days ago");
  });

  it("TEST 11: back targets never trigger scans (pure navigation mapping)", () => {
    // single-wallet views always return home — nothing re-scans by itself
    expect(resolveBackTarget("report", null, false)).toBe("home");
    expect(resolveBackTarget("explore", null, false)).toBe("home");
    // batch-opened wallet returns to its results
    expect(resolveBackTarget("report", "batch", true)).toBe("batch-results");
    expect(resolveBackTarget("explore", "batch", true)).toBe("batch-results");
    // results without data fall back home, never into a scan
    expect(resolveBackTarget("report", "batch", false)).toBe("home");
    // results ↔ preview step back
    expect(resolveBackTarget("batch-results", "batch", true)).toBe("batch");
    expect(resolveBackTarget("batch", null, false)).toBe("home");
  });
});

describe("sanity", () => {
  it("stub helper unused-var guard", () => {
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});
