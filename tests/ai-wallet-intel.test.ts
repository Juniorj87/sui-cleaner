// WALLET INTELLIGENCE LAYER — the AI reasons from REAL Cleaner analysis.
//
// Covers:
//   1. wallet context reaches the provider (overview + buckets + ids);
//   2. balance 0 vs balance > 0 are distinguished into SAFE vs REVIEW;
//   3. "clean first" prioritizes empty cleanable objects;
//   4. "why safe" answers use the actual object classification;
//   5. objects with balance recommend review, never deletion;
//   6. "did I miss anything" uses bucket counts, never claims the user reviewed;
//   7. missing data → no invented facts;
//   8. not-cleanable → AI cannot recommend cleanup;
//   9. no secrets travel to the AI;
//   10. multi-turn with context still works;
//   + deterministic SELECT SAFE TO CLEAN action + client-side id filtering.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleAiRequest } from "../server/ai-proxy.mjs";
import {
  buildWalletContext,
  bucketFor,
  filterSelectableSafeIds,
} from "../src/ai/walletContext";
import type { WalletObject } from "../src/scanner/objectClassifier";

function obj(partial: Partial<WalletObject> & { objectId: string }): WalletObject {
  return {
    type: "0x2::coin::Coin<0x2::sui::SUI>",
    category: "coin",
    classification: "cleanable",
    protected: false,
    reason: "",
    name: "Unnamed",
    collection: "—",
    package: "0x2",
    ...partial,
  } as WalletObject;
}

const CETUS = "0x1111111111111111111111111111111111111111111111111111111111111111";
const OSAIL = "0x2222222222222222222222222222222222222222222222222222222222222222";
const SUI_COIN = "0x3333333333333333333333333333333333333333333333333333333333333333";
const VAULT = "0x4444444444444444444444444444444444444444444444444444444444444444";

const SCAN: WalletObject[] = [
  obj({ objectId: CETUS, name: "CETUS", coinBalance: "0", reason: "Empty coin object, no balance", cleanupAction: "delete", coinType: "0xaf8c::cetus::CETUS" }),
  obj({ objectId: OSAIL, name: "oSAIL-11Dec2025", classification: "review", coinBalance: "1000", reason: "Unknown token with balance", category: "coin" }),
  obj({ objectId: SUI_COIN, name: "SUI", classification: "keep", coinBalance: "5000000000", reason: "Native gas coin" }),
  obj({ objectId: VAULT, name: "Vault", classification: "protected", protected: true, reason: "Protected type", category: "object", type: "0x5::vault::Vault" }),
];

function geminiTextReply(text: string) {
  const body = {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", safetyRatings: [] }],
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

function chatBody(question: string, walletContext: unknown) {
  return JSON.stringify({
    type: "chat", provider: "gemini", apiKey: "AQ.test", model: "gemini-2.5-flash",
    question, objectInput: null, walletStats: null, walletContext, conversationHistory: [],
  });
}

describe("walletContext builder (real scan → buckets)", () => {
  it("distinguishes balance 0 (safe) from balance > 0 (review)", () => {
    expect(bucketFor(SCAN[0]).bucket).toBe("safe");
    expect(bucketFor(SCAN[1]).bucket).toBe("review");
    const ctx = buildWalletContext(SCAN);
    expect(ctx.counts.safe).toBe(1);
    expect(ctx.counts.review).toBe(1);
    expect(ctx.counts.keep).toBe(2);
    expect(ctx.counts.empty).toBe(1);
    expect(ctx.counts.withBalance).toBe(2);
    expect(ctx.total).toBe(4);
  });

  it("cleanable WITH balance lands in review (never unconditional delete)", () => {
    const dusty = obj({ objectId: "0x5555", name: "DUST", coinBalance: "42", classification: "cleanable", cleanupAction: "delete", reason: "Dust merge" });
    expect(bucketFor(dusty)).toEqual({ bucket: "review", hasBalance: true });
  });

  it("protected / keep / unknown land in keep or review — never safe", () => {
    expect(bucketFor(SCAN[2]).bucket).toBe("keep");
    expect(bucketFor(SCAN[3]).bucket).toBe("keep");
    const weird = obj({ objectId: "0x6666", classification: "bogus" as never });
    expect(bucketFor(weird).bucket).toBe("review");
  });

  it("empty scan yields zero counts and no entries (nothing invented)", () => {
    const ctx = buildWalletContext([]);
    expect(ctx.total).toBe(0);
    expect(ctx.safe).toEqual([]);
    expect(ctx.review).toEqual([]);
    expect(ctx.safeIds).toEqual([]);
    expect(ctx.keepSample).toEqual([]);
  });

  it("carries no secrets — only public on-chain data", () => {
    const dumped = JSON.stringify(buildWalletContext(SCAN)).toLowerCase();
    for (const banned of ["privatekey", "private_key", "seed", "mnemonic", "secret", "apikey", "api_key", "password", "credential"]) {
      expect(dumped).not.toContain(banned);
    }
  });
});

describe("filterSelectableSafeIds (trust-but-verify)", () => {
  it("keeps live cleanable ids, drops protected / non-cleanable / stale", () => {
    const out = filterSelectableSafeIds([CETUS, OSAIL, VAULT, "0xdead", SUI_COIN], SCAN);
    expect(out).toEqual([CETUS]);
  });
});

describe("ai-proxy wallet intelligence prompt", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function sentPrompt() {
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    return JSON.parse(calls[calls.length - 1][1].body).contents.map(
      (c: { parts: Array<{ text: string }> }) => c.parts[0].text
    ).join("\n");
  }

  it("sends overview + buckets + ids + reasons (real context, no invention)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    const ctx = buildWalletContext(SCAN);
    const r = await handleAiRequest(chatBody("Analyze my wallet", ctx));
    expect(r.status).toBe(200);
    const prompt = sentPrompt();
    expect(prompt).toContain("Total objects: 4");
    expect(prompt).toContain("SAFE TO CLEAN: 1");
    expect(prompt).toContain("REVIEW: 1");
    expect(prompt).toContain("KEEP: 2");
    expect(prompt).toContain("CETUS");
    expect(prompt).toContain(CETUS);
    expect(prompt).toContain("Empty coin object, no balance");
    expect(prompt).toContain("oSAIL-11Dec2025");
  });

  it("clean-first prioritizes empty objects and explains the order", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("What should I clean first?", buildWalletContext(SCAN)));
    const prompt = sentPrompt();
    const safeAt = prompt.indexOf("SAFE TO CLEAN —");
    const reviewAt = prompt.indexOf("REVIEW —");
    expect(safeAt).toBeGreaterThan(-1);
    expect(reviewAt).toBeGreaterThan(safeAt);
    const p1 = prompt.indexOf("1) empty objects");
    const p4 = prompt.indexOf("4) never objects containing balance");
    expect(p1).toBeGreaterThan(-1);
    expect(p4).toBeGreaterThan(p1);
    expect(prompt).toContain("Cleaner classifies this as safe to clean");
  });

  it("why-safe answers are grounded in the actual classification", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("Why is CETUS safe to remove?", buildWalletContext(SCAN)));
    const prompt = sentPrompt();
    expect(prompt).toContain("CETUS");
    expect(prompt).toContain("balance 0");
    expect(prompt).toContain("never \"this is definitely safe\"");
  });

  it("balance objects get review-first rules, never deletion", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("Can I delete oSAIL?", buildWalletContext(SCAN)));
    const prompt = sentPrompt();
    expect(prompt).toContain("contains balance 1000");
    expect(prompt).toContain("recommend REVIEW first");
  });

  it("did-miss-anything uses bucket counts and never claims the user reviewed", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    const r = await handleAiRequest(chatBody("Did I miss anything?", buildWalletContext(SCAN)));
    expect(r.status).toBe(200);
    // informational question → no select action attached
    expect((r.body as { action?: unknown }).action).toBeUndefined();
    const prompt = sentPrompt();
    expect(prompt).toContain("Never claim the user already reviewed");
  });

  it("not-cleanable objects can never be recommended for cleanup", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("Can I delete the Vault?", buildWalletContext(SCAN)));
    const prompt = sentPrompt();
    expect(prompt).toContain("Vault");
    expect(prompt).toContain("is not cleanable, NEVER say the object can be safely deleted");
  });

  it("missing data yields empty sections + no-invention rule, not facts", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("What should I clean first?", buildWalletContext([])));
    const prompt = sentPrompt();
    expect(prompt).toContain("Total objects: 0");
    expect(prompt).toContain("(none listed)");
    expect(prompt).toContain("I don't have enough on-chain information to determine this.");
    expect(prompt).not.toContain("CETUS");
  });

  it("cleaning intent attaches a deterministic SELECT SAFE TO CLEAN action", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    const r = await handleAiRequest(chatBody("What should I clean first?", buildWalletContext(SCAN)));
    expect(r.status).toBe(200);
    const action = (r.body as { action?: { type: string; objectIds: string[]; count: number; label: string } }).action;
    expect(action?.type).toBe("select_safe");
    expect(action?.objectIds).toEqual([CETUS]);
    expect(action?.count).toBe(1);
    expect(action?.label).toContain("SELECT SAFE TO CLEAN");
  });

  it("accepts non-0x ids too (demo scans use short ids; UI re-validates)", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(geminiTextReply("ok"));
    const ctx = buildWalletContext([
      obj({ objectId: "o26", name: "Pixel Pudgy #7", category: "nft", classification: "cleanable", cleanupAction: "burn", reason: "Cleanup verified" }),
    ]);
    expect(ctx.safeIds).toEqual(["o26"]);
    const r = await handleAiRequest(chatBody("Analyze my wallet", ctx));
    const action = (r.body as { action?: { type: string; objectIds: string[]; count: number } }).action;
    expect(action?.type).toBe("select_safe");
    expect(action?.objectIds).toEqual(["o26"]);
    expect(action?.count).toBe(1);
  });

  it("non-cleaning questions and empty safe lists get no action", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("ok"));
    const r1 = await handleAiRequest(chatBody("What should I keep?", buildWalletContext(SCAN)));
    expect((r1.body as { action?: unknown }).action).toBeUndefined();
    const r2 = await handleAiRequest(chatBody("What should I clean first?", buildWalletContext([])));
    expect((r2.body as { action?: unknown }).action).toBeUndefined();
  });

  it("multi-turn with context still works and history reaches the model", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("answer"));
    const ctx = buildWalletContext(SCAN);
    const r1 = await handleAiRequest(chatBody("What is this token?", ctx));
    expect(r1.status).toBe(200);
    const body2 = JSON.parse(chatBody("Can I remove it?", ctx));
    body2.conversationHistory = [
      { role: "user", content: "What is this token?" },
      { role: "assistant", content: "answer" },
    ];
    const r2 = await handleAiRequest(JSON.stringify(body2));
    expect(r2.status).toBe(200);
    expect((r2.body as { text: string }).text).toBe("answer");
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body);
    const roles = sent.contents.map((c: { role: string }) => c.role);
    expect(roles).toEqual(["user", "model", "user"]);
    // history turns first, then the current turn carrying the wallet context
    expect(sent.contents[2].parts[0].text).toContain("WALLET OVERVIEW");
    expect(sent.contents[2].parts[0].text).toContain("Can I remove it?");
  });
});
