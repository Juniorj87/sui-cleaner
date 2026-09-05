// Market data honesty: NFT floors + live network stats.
//
// - Blockberry floor figures follow the codebase base-unit convention
//   (integers = MIST); fractional values are already SUI. Anything else
//   (zero, negative, junk) is unknown — the UI renders "Floor —".
// - /api/network-stats returns live price + checkpoint or nulls, never
//   invented numbers.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  normalizeFloorPrice,
  withNftFloors,
  handleNetworkStats,
  resetNetworkStatsCache,
  resetCoinGeckoCache,
} from "../server/ai-proxy.mjs";
import { formatFloorSui } from "../src/types/portfolio";

describe("normalizeFloorPrice (Blockberry base-unit convention)", () => {
  it("integer MIST values convert to SUI", () => {
    expect(normalizeFloorPrice(2_500_000_000)).toEqual({ sui: 2.5 });
    expect(normalizeFloorPrice(500_000_000)).toEqual({ sui: 0.5 });
    expect(normalizeFloorPrice("1000000000")).toEqual({ sui: 1 });
  });

  it("fractional values are already SUI", () => {
    expect(normalizeFloorPrice(2.5)).toEqual({ sui: 2.5 });
    expect(normalizeFloorPrice(0.042)).toEqual({ sui: 0.042 });
  });

  it("zero, negative, dust integers and junk are unknown", () => {
    expect(normalizeFloorPrice(0)).toBeNull();
    expect(normalizeFloorPrice(-5)).toBeNull();
    expect(normalizeFloorPrice(42)).toBeNull(); // 42 MIST = dust, not a price
    expect(normalizeFloorPrice("")).toBeNull();
    expect(normalizeFloorPrice("n/a")).toBeNull();
    expect(normalizeFloorPrice(null)).toBeNull();
    expect(normalizeFloorPrice(undefined)).toBeNull();
    expect(normalizeFloorPrice(NaN)).toBeNull();
  });
});

describe("withNftFloors (portfolio passthrough)", () => {
  it("attaches known floors, marks the rest unknown", () => {
    const out = withNftFloors([
      { name: "A", floorPrice: 2_500_000_000 },
      { name: "B" },
      { name: "C", floorPrice: 0 },
      null,
    ]);
    expect(out[0]).toMatchObject({ floorPriceSui: 2.5, floorPriceKnown: true });
    expect(out[1]).toMatchObject({ floorPriceSui: null, floorPriceKnown: false });
    expect(out[2]).toMatchObject({ floorPriceSui: null, floorPriceKnown: false });
    expect(out[3]).toBeNull();
  });

  it("non-arrays pass through as empty", () => {
    expect(withNftFloors(null)).toEqual([]);
    expect(withNftFloors(undefined)).toEqual([]);
  });
});

describe("formatFloorSui", () => {
  it("compacts decimals, guards garbage", () => {
    expect(formatFloorSui(2.5)).toBe("2.5");
    expect(formatFloorSui(0.042)).toBe("0.042");
    expect(formatFloorSui(0)).toBe("—");
    expect(formatFloorSui(-1)).toBe("—");
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
