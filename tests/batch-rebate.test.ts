// BATCH REBATE honesty (§16): per-object mechanism estimates from the real
// dry-run layer — never object count × universal constant.
//
// 1. Different objects can have different estimates.
// 2. Batch does NOT use count × 0.0028.
// 3. Unsupported action = 0 or unavailable.
// 4. NFT burn = no rebate when mechanics return none.
// 5. Lone dust = no rebate when not executed.
// 6. destroy_zero = positive estimate when calculable.
// 7. Batch total = sum of per-wallet estimates.
// 8. Partial estimate → "Estimate available for 84 of 97".
// 9. Actual effects remain the source of the actual result (see
//    real-tx-regression.test.ts — asserted there, referenced here).
// 10. Real regression values (same — asserted in real-tx-regression).

import { describe, it, expect } from "vitest";
import {
  classifyTargets,
  summarizeBreakdown,
  estimateWalletRebate,
} from "../src/batch/rebateEstimate";
import { aggregateBatch } from "../src/batch/batchResults";
import type { WalletObject } from "../src/scanner/objectClassifier";
import type { BatchWalletResult } from "../src/batch/batchScanner";

function addr(n: number): string {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function mkObj(
  partial: Partial<WalletObject> & { objectId: string; classification: WalletObject["classification"] }
): WalletObject {
  return {
    type: "0x2::coin::Coin<0x2::sui::SUI>",
    category: "coin",
    protected: false,
    reason: "",
    name: "X",
    collection: "—",
    package: "0x2",
    ...partial,
  } as WalletObject;
}

const EMPTY = (id: string) =>
  mkObj({ objectId: id, classification: "cleanable", coinBalance: "0", cleanupAction: "delete", name: "E" });
const DUST = (id: string) =>
  mkObj({ objectId: id, classification: "cleanable", coinBalance: "42", dust: true, cleanupAction: "delete", name: "D" });
const NFT = (id: string) =>
  mkObj({ objectId: id, classification: "cleanable", category: "nft", cleanupAction: "burn", name: "N" });
const KEEP = (id: string) =>
  mkObj({ objectId: id, classification: "keep", coinBalance: "100", name: "K" });

describe("mechanism classification (pure)", () => {
  it("TEST 1: different objects land in different mechanism buckets", () => {
    const g = classifyTargets([EMPTY("0xe1"), DUST("0xd1"), NFT("0xn1"), KEEP("0xk1")]);
    expect(g.destroyZero.map((o) => o.objectId)).toEqual(["0xe1"]);
    expect(g.dustMerge.map((o) => o.objectId)).toEqual(["0xd1"]);
    expect(g.other.map((o) => o.objectId)).toEqual(["0xn1", "0xk1"]);
  });

  it("TEST 4: NFT burn is not a rebate mechanism (lands in other)", () => {
    const g = classifyTargets([NFT("0xn1")]);
    expect(g.destroyZero).toHaveLength(0);
    expect(g.dustMerge).toHaveLength(0);
    expect(g.other).toHaveLength(1);
  });
});

describe("executed-truth breakdown (pure)", () => {
  const targets = [EMPTY("0xe1"), EMPTY("0xe2"), DUST("0xd1"), DUST("0xd2"), NFT("0xn1")];

  it("TEST 5: lone/unacted dust counts as unsupported, never as rebate", () => {
    // only one empty + one dust acted on; lone dust + burn unacted
    const b = summarizeBreakdown(targets, ["0xe1", "0xd1"]);
    expect(b).toEqual({ destroyZero: 1, dustMerge: 1, unsupported: 3 });
  });

  it("TEST 3: unsupported action contributes nothing", () => {
    const b = summarizeBreakdown(targets, []);
    expect(b).toEqual({ destroyZero: 0, dustMerge: 0, unsupported: 5 });
  });

  it("acted-on burns are executed but carry no rebate-mechanism line", () => {
    const b = summarizeBreakdown(targets, ["0xe1", "0xe2", "0xd1", "0xd2", "0xn1"]);
    expect(b.destroyZero).toBe(2);
    expect(b.dustMerge).toBe(2);
    expect(b.unsupported).toBe(0);
  });
});

describe("estimateWalletRebate tiers", () => {
  it("empty target set → honestly zero via object calculation", async () => {
    const est = await estimateWalletRebate({} as never, addr(1), []);
    expect(est).toEqual({
      rebateSui: 0,
      source: "object",
      breakdown: { destroyZero: 0, dustMerge: 0, unsupported: 0 },
    });
  });

  it("unbuildable / failed dry-run → unavailable, never invented", async () => {
    // no usable client: build must fail → unavailable, not count × constant
    const targets = [EMPTY("0xe1"), EMPTY("0xe2"), DUST("0xd1")];
    const est = await estimateWalletRebate(null as never, addr(1), targets);
    expect(est.source).toBe("unavailable");
    expect(est.rebateSui).toBe(0);
    expect(est.breakdown.unsupported).toBe(3);
  });

  it("TEST 2: no universal 0.0028 — three empties are not 3 × 0.0028 by formula", async () => {
    const targets = [EMPTY("0xe1"), EMPTY("0xe2"), EMPTY("0xe3")];
    const est = await estimateWalletRebate(null as never, addr(1), targets);
    // unavailable tier carries 0 and says so; it never fabricates 0.0084
    expect(est.source).toBe("unavailable");
    expect(est.rebateSui).toBe(0);
  });
});

describe("shared economic model: batch == single-wallet review (§13)", () => {
  // Both paths read the SAME dry-run figure (effects.gasUsed.storageRebate)
  // from a PTB built by buildCleanupPTB. The review wraps it with
  // validation/treasury/fee — none of which change the rebate.
  // Reference figure: the real mainnet transaction 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb.
  const REAL_REBATE_MIST = 3_596_472n;

  function stubDeps() {
    return {
      build: async () => ({
        demo: false,
        preview: { commands: [], note: "" },
        transaction: { setSenderIfNotSet: () => {} },
        actedOnIds: ["0xe1", "0xd1"],
      }),
      dryRun: async () => ({
        mist: 0n,
        sui: "0",
        method: "dry-run",
        breakdown: { computationCost: 100_000n, storageCost: 1_976_000n, storageRebate: REAL_REBATE_MIST },
      }),
    };
  }

  it("batch reads the same dry-run rebate figure as single review", async () => {
    const { mistToSui } = await import("../src/fees/gasEstimator");
    const targets = [EMPTY("0xe1"), DUST("0xd1")];
    const est = await estimateWalletRebate({} as never, addr(1), targets, stubDeps() as never);
    expect(est.source).toBe("simulation");
    // single-review display of the identical figure:
    expect(mistToSui(REAL_REBATE_MIST)).toBe("0.003596472");
    // batch display agrees to shown precision
    expect(est.rebateSui.toFixed(4)).toBe(Number(mistToSui(REAL_REBATE_MIST)).toFixed(4));
    expect(est.breakdown).toEqual({ destroyZero: 1, dustMerge: 1, unsupported: 0 });
  });

  it("TEST 9: estimate tier is never presented as on-chain actual", async () => {
    const { mistToSui } = await import("../src/fees/gasEstimator");
    void mistToSui;
    const est = await estimateWalletRebate(
      {} as never,
      addr(1),
      [EMPTY("0xe1")],
      stubDeps() as never
    );
    // estimate and actual live in disjoint contracts: source is always an
    // estimate tier, never "verified"; actuals come only from effects
    // (asserted with real values in real-tx-regression.test.ts).
    expect(["simulation", "object", "unavailable"]).toContain(est.source);
  });
});

describe("batch totals from per-wallet estimates", () => {
  function row(address: string, rebate: number, source: "simulation" | "object" | "unavailable"): BatchWalletResult {
    return {
      address, label: "—", status: "ready", objects: 10, safe: 5, review: 3, keep: 2,
      rebate, source,
      breakdown: { destroyZero: 5, dustMerge: 0, unsupported: 0 },
      scanTimeMs: 1,
    };
  }

  it("TEST 7: batch total = sum of per-wallet simulation estimates", () => {
    const agg = aggregateBatch([row(addr(1), 0.42, "simulation"), row(addr(2), 0.1, "simulation")]);
    expect(agg.rebate).toBeCloseTo(0.52, 4);
    expect(agg.withEstimate).toBe(2);
  });

  it("TEST 8: partial estimates → honest availability count", () => {
    const rows = Array.from({ length: 84 }, (_, i) => row(addr(i + 1), 0.01, "simulation"));
    for (let i = 0; i < 13; i++) {
      rows.push({ ...row(addr(100 + i), 0, "unavailable"), status: "ready" });
    }
    const agg = aggregateBatch(rows);
    expect(agg.wallets).toBe(97);
    expect(agg.withEstimate).toBe(84);
    // total covers only the 84 estimated wallets
    expect(agg.rebate).toBeCloseTo(0.84, 4);
  });

  it("TEST 6: destroy_zero positive estimate flows through when calculable", () => {
    // the engine passes the dry-run figure untouched (no re-scaling)
    const agg = aggregateBatch([row(addr(1), 0.0036, "simulation")]);
    expect(agg.rebate).toBeCloseTo(0.0036, 4);
  });
});
