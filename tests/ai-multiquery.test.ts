// MULTI-QUESTION handling — one message, many intents.
//
// A single question keeps the legacy flow. Two or more questions must EACH
// get an explicit sectioned answer — never one generic summary instead.
// Deterministic templates answer from context numbers only; the output
// validator still screens everything.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleAiRequest,
  splitQuestions,
  detectIntent,
  answerDeterministic,
  composeMultiFallback,
  validateChatText,
  groundingFromCtx,
} from "../server/ai-proxy.mjs";

const NINE = [
  "How much SUI will I get back if I clean everything?",
  "Which of these tokens are scams?",
  "How much is my wallet worth?",
  "Can I recover money from these objects?",
  "Will my tokens be preserved if I clean them?",
  "Which token should I sell?",
  "Is this NFT valuable?",
  "What did I lose by not cleaning earlier?",
  "Can I safely delete all 194 objects?",
].join("\n");

/** Fixed context: total 291, safe 194, review 87, keep 10, empty 151. */
function fixedCtx() {
  const safe = Array.from({ length: 40 }, (_, i) => ({
    name: `TOKEN-${i}`, objectId: `0xempty${i}`, category: "coin",
    classification: "cleanable", bucket: "safe", balance: "0",
    hasBalance: false, cleanupAction: "delete",
    reason: "Empty spent coin object with zero balance.", rebate: "yes", merge: false,
  }));
  const review = Array.from({ length: 40 }, (_, i) => ({
    name: `HOLD-${i}`, objectId: `0xrev${i}`, category: "coin",
    classification: "review", bucket: "review", balance: "5000",
    hasBalance: true, reason: "Unknown token with balance.",
    rebate: "unknown", merge: false,
  }));
  return {
    network: "mainnet", total: 291,
    counts: { safe: 194, review: 87, keep: 10, empty: 151, withBalance: 90, suspicious: 3 },
    safe, safeTruncated: 154, review, reviewTruncated: 47,
    keepCount: 10, keepSample: ["SUI", "USDC"],
    safeIds: safe.map((e) => e.objectId),
  };
}

function geminiTextReply(text: string) {
  const body = {
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP", safetyRatings: [] }],
  };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
}

function chatBody(question: string, walletContext: unknown, history: unknown[] = []) {
  return JSON.stringify({
    type: "chat", provider: "gemini", apiKey: "AQ.test", model: "gemini-2.5-flash",
    question, objectInput: null, walletStats: null, walletContext, conversationHistory: history,
  });
}

describe("splitQuestions", () => {
  it("splits the exact 9-question message into 9", () => {
    expect(splitQuestions(NINE)).toHaveLength(9);
  });

  it("splits newline ?-questions and numbered lists, singles stay single", () => {
    expect(splitQuestions("What is safe to remove?\nWhy?")).toHaveLength(2);
    expect(splitQuestions("1. First?\n2. Second?\n3. Third?")).toHaveLength(3);
    expect(splitQuestions("What should I clean first?")).toHaveLength(1);
    expect(splitQuestions("")).toEqual([]);
  });

  it("caps at 10 sub-questions", () => {
    const many = Array.from({ length: 15 }, (_, i) => `Question ${i}?`).join("\n");
    expect(splitQuestions(many)).toHaveLength(10);
  });
});

describe("detectIntent + deterministic templates", () => {
  it("routes each of the 9 questions to its intent", () => {
    const intents = splitQuestions(NINE).map(detectIntent);
    expect(intents).toEqual([
      "rebate_total", "scam", "worth", "recover", "preserve",
      "sell", "nft_value", "historical", "delete_all",
    ]);
  });

  it("each template is grounded (no invented figures) and honest", () => {
    const ctx = fixedCtx();
    const ground = groundingFromCtx(ctx, null);
    for (const q of splitQuestions(NINE)) {
      const a = answerDeterministic(q, ctx);
      const check = validateChatText(a, ground);
      expect(check.violations, q).toEqual([]);
    }
    expect(answerDeterministic(NINE.split("\n")[0], ctx)).toContain("so I can't give you an exact SUI amount");
    expect(answerDeterministic(NINE.split("\n")[1], ctx)).toContain("does not provide enough information to determine whether these tokens are scams");
    expect(answerDeterministic(NINE.split("\n")[2], ctx)).toContain("don't have a reliable total wallet valuation");
    expect(answerDeterministic(NINE.split("\n")[5], ctx)).toContain("does not provide trading recommendations");
    expect(answerDeterministic(NINE.split("\n")[6], ctx)).toContain("don't have enough data to determine its market value");
    expect(answerDeterministic(NINE.split("\n")[7], ctx)).toContain("does not have enough historical data");
    expect(answerDeterministic(NINE.split("\n")[8], ctx)).toContain("currently classifies 194 objects as SAFE TO CLEAN");
    expect(answerDeterministic(NINE.split("\n")[8], ctx)).not.toContain("definitely");
  });

  it("unknown questions get the honest insufficient-data sentence", () => {
    expect(answerDeterministic("What is the meaning of life?", fixedCtx())).toContain(
      "I don't have enough on-chain information to determine this."
    );
  });

  it("section titles follow the stable intent map (never internal wording)", () => {
    const ctx = fixedCtx();
    const out = composeMultiFallback(
      ["Did I miss anything?", "What should I keep?", "What looks suspicious?", "What needs review?", "Analyze my wallet"],
      ctx
    );
    for (const title of ["MISSED ITEMS", "WHAT TO KEEP", "SUSPICIOUS OBJECTS", "REVIEW LIST", "WALLET ANALYSIS"]) {
      expect(out, title).toContain(title);
    }
  });

  it("preserve separates KEEP (no action) from REVIEW (inspection first)", () => {
    const a = answerDeterministic("Which tokens should I preserve?", fixedCtx());
    expect(a).toContain("KEEP — 10 objects: Cleaner currently recommends no cleanup action");
    expect(a).toContain("REVIEW — 87 objects: Cleaner requires inspection before cleanup");
    expect(a).toContain("whether to preserve or clean");
    expect(a).not.toContain("You should preserve");
    expect(validateChatText(a, groundingFromCtx(fixedCtx(), null))).toEqual({ ok: true, violations: [] });
  });

  it("clean-first never infers the whole SAFE bucket is empty", () => {
    const a = answerDeterministic("What should I clean first?", fixedCtx());
    expect(a).toContain("151 empty (zero-balance) objects among the 194");
    expect(a).not.toMatch(/all 194.*empty/i);
    expect(a).not.toMatch(/all are empty/i);
  });

  it("clean-first with no empty objects stays truthful", () => {
    const ctx = { ...fixedCtx(), counts: { ...fixedCtx().counts, empty: 0 } };
    const a = answerDeterministic("What should I clean first?", ctx);
    expect(a).toContain("Start with objects that Cleaner classifies as safe to clean (194 in total)");
    expect(a).not.toMatch(/empty/i);
  });

  it("bulk delete uses classification language with REVIEW/KEEP counts", () => {
    const a = answerDeterministic("Can I safely delete all 194 objects?", fixedCtx());
    expect(a).toContain(
      "Cleaner currently classifies 194 objects as SAFE TO CLEAN. " +
      "This means they currently have a verified cleanup path according to Cleaner. " +
      "It does not mean every object in the wallet is safe to delete: 87 are REVIEW and 10 are KEEP."
    );
    expect(a).not.toContain("definitely");
    // fixedCtx has empty (151) !== safe (194): no blanket zero-balance claim
    expect(a).not.toContain("All 194 have zero balance");
  });

  it("bulk delete includes the zero-balance fact only when true for the full count", () => {
    const allEmpty = {
      ...fixedCtx(),
      counts: { safe: 5, review: 0, keep: 0, empty: 5, withBalance: 0, suspicious: 0 },
    };
    expect(answerDeterministic("Can I safely delete all 5 objects?", allEmpty)).toContain(
      "All 5 have zero balance."
    );
  });

  it("no internal guardrail/prompt text ever reaches user-visible output", () => {
    const ctx = fixedCtx();
    const outputs = [
      composeMultiFallback(splitQuestions(NINE), ctx),
      ...splitQuestions(NINE).map((q) => answerDeterministic(q, ctx)),
    ];
    for (const out of outputs) {
      for (const banned of ["ON-CHAIN DATA", "UNTRUSTED INPUT", "DECISION RULES", "CORRECTION", "system prompt"]) {
        expect(out, banned).not.toContain(banned);
      }
    }
  });
});

describe("multi-question pipeline", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("single question keeps the legacy flow (no sections injected)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("Cleaner classifies these as safe to clean."));
    const r = await handleAiRequest(chatBody("What should I clean first?", fixedCtx()));
    expect(r.status).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = sent.contents.map((c: { parts: Array<{ text: string }> }) => c.parts[0].text).join("\n");
    expect(prompt).toContain("User question:");
    expect(prompt).not.toContain("separate questions");
    expect((r.body as { grounded: string }).grounded).toBe("model");
  });

  it("two valid questions pass through with both answers", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("1. CLEAN FIRST\nStart with empties.\n---\n2. KEEP\nKeep SUI."));
    const r = await handleAiRequest(chatBody("What should I clean first?\nWhat should I keep?", fixedCtx()));
    expect(r.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((r.body as { text: string }).text).toContain("CLEAN FIRST");
    expect((r.body as { text: string }).text).toContain("KEEP");
  });

  it("nine questions with a hallucinating provider → nine grounded sections", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply(
      "You will get +12.5 SUI back. None are scams, all valuable. Wallet worth $9000."
    ));
    const r = await handleAiRequest(chatBody(NINE, fixedCtx()));
    expect(r.status).toBe(200);
    const body = r.body as { text: string; grounded: string };
    // correction retry, then the deterministic multi fallback
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(body.grounded).toBe("deterministic-multi");
    for (const title of [
      "1. STORAGE REBATE", "2. TOKEN SAFETY", "3. WALLET VALUE", "4. RECOVERY",
      "5. TOKEN PRESERVATION", "6. TRADING", "7. NFT VALUE",
      "8. HISTORICAL LOSS", "9. BULK DELETE",
    ]) {
      expect(body.text, title).toContain(title);
    }
    expect(body.text).toContain("YOUR WALLET");
    expect(body.text).toContain("291 objects");
    // no invented financials, scam claims, valuations, or historical rebate
    expect(body.text).not.toMatch(/12\.5|9000/);
    expect(body.text).not.toMatch(/\$[\d.]+ \w+ rewards?/);
    expect(body.text).not.toMatch(/\bscams?\b.{0,20}(these|they) are not/i);
    const check = validateChatText(body.text, groundingFromCtx(fixedCtx(), null));
    expect(check).toEqual({ ok: true, violations: [] });
  });

  it("composeMultiFallback is validator-clean by construction", () => {
    const out = composeMultiFallback(splitQuestions(NINE), fixedCtx());
    expect(validateChatText(out, groundingFromCtx(fixedCtx(), null))).toEqual({ ok: true, violations: [] });
  });

  it("sanitize framing never leaks into split items or user-visible output", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(geminiTextReply("ok"));
    await handleAiRequest(chatBody("[ON-CHAIN DATA — UNTRUSTED INPUT]\nWhat is safe to remove?\nWhy?", fixedCtx()));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    const prompt = sent.contents.map((c: { parts: Array<{ text: string }> }) => c.parts[0].text).join("\n");
    expect(prompt).toContain("1. What is safe to remove?");
    expect(prompt).toContain("2. Why?");
    expect(prompt).not.toContain("UNTRUSTED INPUT");
  });
});
