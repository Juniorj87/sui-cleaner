// Market data honesty: NFT floors + live network stats.
//
// - Blockberry floor figures follow the codebase base-unit convention
//   (integers = MIST); fractional values are already SUI. Anything else
//   (zero, negative, junk) is unknown — the UI renders "Floor —".
// - /api/network-stats returns live price + checkpoint or nulls, never
//   invented numbers.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeSuiAmount,
  withNftPrices,
  handleNetworkStats,
  resetNetworkStatsCache,
  resetCoinGeckoCache,
} from "../server/ai-proxy.mjs";
import { formatSuiAmount } from "../src/types/portfolio";

describe("normalizeSuiAmount (live Blockberry One convention)", () => {
  it("human-readable decimals pass through as SUI (verified live: 3.2)", () => {
    expect(normalizeSuiAmount(3.2)).toEqual({ sui: 3.2 });
    expect(normalizeSuiAmount(2.5)).toEqual({ sui: 2.5 });
    expect(normalizeSuiAmount(0.042)).toEqual({ sui: 0.042 });
    expect(normalizeSuiAmount(2)).toEqual({ sui: 2 });
    expect(normalizeSuiAmount("1000000000")).toEqual({ sui: 1000000000 });
  });

  it("impossible magnitudes (≥ total supply) fall back to MIST", () => {
    expect(normalizeSuiAmount(2_500_000_000_000)).toEqual({ sui: 2500 });
  });

  it("zero, negative and junk are unknown", () => {
    expect(normalizeSuiAmount(0)).toBeNull();
    expect(normalizeSuiAmount(-5)).toBeNull();
    expect(normalizeSuiAmount("")).toBeNull();
    expect(normalizeSuiAmount("n/a")).toBeNull();
    expect(normalizeSuiAmount(null)).toBeNull();
    expect(normalizeSuiAmount(undefined)).toBeNull();
    expect(normalizeSuiAmount(NaN)).toBeNull();
  });
});

describe("withNftPrices (portfolio passthrough)", () => {
  it("attaches real last sales, marks the rest unknown", () => {
    const out = withNftPrices([
      { name: "SEED Mon", latestPrice: 3.2 },
      { name: "B" },
      { name: "C", latestPrice: null },
      null,
    ]);
    expect(out[0]).toMatchObject({ lastSaleSui: 3.2, lastSaleKnown: true });
    expect(out[1]).toMatchObject({ lastSaleSui: null, lastSaleKnown: false });
    expect(out[2]).toMatchObject({ lastSaleSui: null, lastSaleKnown: false });
    expect(out[3]).toBeNull();
  });

  it("non-arrays pass through as empty", () => {
    expect(withNftPrices(null)).toEqual([]);
    expect(withNftPrices(undefined)).toEqual([]);
  });
});

describe("formatSuiAmount", () => {
  it("compacts decimals, guards garbage", () => {
    expect(formatSuiAmount(2.5)).toBe("2.5");
    expect(formatSuiAmount(0.042)).toBe("0.042");
    expect(formatSuiAmount(0)).toBe("—");
    expect(formatSuiAmount(-1)).toBe("—");
  });
});

describe("handleNetworkStats (live, keyless)", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); resetNetworkStatsCache(); resetCoinGeckoCache(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  function stubAll(price: number | null, checkpoint: unknown) {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes("coingecko")) {
        if (price == null) return Promise.resolve({ ok: false, status: 429 });
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: "sui", current_price: price, market_cap: 1, total_volume: 1, price_change_percentage_24h: 0, image: null }],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: checkpoint }),
      });
    });
  }

  it("returns live price + checkpoint", async () => {
    stubAll(3.42, "318421005");
    const r = await handleNetworkStats();
    expect(r.status).toBe(200);
    expect(r.body.suiUsd).toBe(3.42);
    expect(r.body.checkpoint).toBe(318421005);
  });

  it("returns nulls instead of invented numbers when sources fail", async () => {
    stubAll(null, null);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes("coingecko")) return Promise.resolve({ ok: false, status: 429 });
      return Promise.reject(new Error("down"));
    });
    const r = await handleNetworkStats();
    expect(r.status).toBe(200);
    expect(r.body.suiUsd).toBeNull();
    expect(r.body.checkpoint).toBeNull();
  });
});
