/**
 * AIAssistant — full chat-style assistant panel for SuiCleaner.
 *
 * Features:
 *   - Conversation memory (last 20 messages)
 *   - Object mode / Wallet mode
 *   - Always-visible quick questions
 *   - Action buttons on analysis cards
 *   - Token limit warning
 *   - Privacy notice
 *
 * AI NEVER signs, sends, or authorizes transactions.
 * AI NEVER overrides deterministic classification.
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { Sparkles } from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";
import type { AIAnalysis, AIProviderConfig } from "../../ai/provider";
import type { UseAIKeyReturn } from "../../ai/useAIKey";
import { askChat, buildAnalysisInput, resetChatThrottle } from "../../ai/analyzer";
import { buildWalletContext, filterSelectableSafeIds, type ChatAction } from "../../ai/walletContext";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  analysis?: AIAnalysis;
  /** deterministic follow-up action (e.g. pre-select safe objects) */
  action?: ChatAction;
  timestamp: number;
}

interface AIAssistantProps {
  aiKey: UseAIKeyReturn;
  objects: WalletObject[];
  focusObject?: WalletObject | null;
  onClose: () => void;
  onSelectForCleanup?: (objectId: string) => void;
  onKeep?: (objectId: string) => void;
  /** bulk pre-select for the existing review flow (AI never signs) */
  onSelectMany?: (objectIds: string[]) => void;
  onOpenSettings?: () => void;
}

const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_MESSAGES = 20;

const WALLET_QUICK_QUESTIONS = [
  "Which assets should I keep?",
  "What looks suspicious?",
  "What is safe to remove?",
  "What needs review?",
  "What should I clean first?",
  "Why is this safe to remove?",
  "Did I miss anything?",
];

const OBJECT_QUICK_QUESTIONS = [
  "What is this?",
  "Can I clean it?",
  "Why is this protected?",
  "Why is this safe to remove?",
  "What should I do?",
];

function verdictBadge(v: string): string {
  switch (v) {
    case "KEEP": return "badge-keep";
    case "REVIEW": return "badge-review";
    case "PROTECTED": return "badge-protected";
    case "SAFE_TO_CLEAN": return "badge-clean";
    case "SWEEP_TO_SUI": return "badge-sweep";
    default: return "badge-none";
  }
}

function confidenceBadge(c: string): string {
  switch (c) {
    case "HIGH": return "conf-high";
    case "MEDIUM": return "conf-medium";
    case "LOW": return "conf-low";
    default: return "conf-low";
  }
}

interface AIErrorState {
  message: string;
  action: "dismiss" | "settings" | "retry";
}

export default function AIAssistant({ aiKey, objects, focusObject, onClose, onSelectForCleanup, onKeep, onSelectMany, onOpenSettings }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AIErrorState | null>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchronous in-flight guard: two clicks in the same tick (double-click,
  // Enter + button) must not fire two provider requests and burn quota.
  const sendingRef = useRef(false);
  const lastQuestionRef = useRef<string | null>(null);
  /** message ids whose SELECT action was already applied */
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());

  const quickQuestions = focusObject ? OBJECT_QUICK_QUESTIONS : WALLET_QUICK_QUESTIONS;

  // Auto-scroll: only the chat area scrolls, and the newest message stays
  // visible after every send/receive. The window itself never scrolls.
  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Add welcome message on mount (functional guard — StrictMode double
  // effects must not append it twice).
  useEffect(() => {
    const welcome: ChatMessage = {
      id: "welcome",
      role: "assistant",
      content: focusObject
        ? `I can help you understand this ${focusObject.name || "object"}. Ask me anything about it.`
        : "I can explain your assets, help identify suspicious objects and guide you through cleaning decisions.",
      timestamp: Date.now(),
    };
    setMessages((prev) => (prev.length === 0 ? [welcome] : prev));
  }, [focusObject]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Distinct, actionable message per failure kind — never one blanket error. */
  const errorFor = (msg: string): AIErrorState => {
    if (msg === "RATE_LIMITED") return { message: "Too many requests. Please wait a moment.", action: "retry" };
    if (msg === "AI_RATE_LIMITED") return { message: "Rate limit reached. Wait a minute, then retry.", action: "retry" };
    if (msg === "INVALID_API_KEY" || msg === "AI_INVALID_KEY") return { message: "AI CONNECTION FAILED — CHECK YOUR API KEY", action: "settings" };
    if (msg === "AI_BAD_MODEL") return { message: "MODEL UNAVAILABLE — PICK ANOTHER MODEL IN AI SETTINGS", action: "settings" };
    if (msg === "AI_PROVIDER_DOWN" || msg === "AI_NETWORK") return { message: "AI PROVIDER UNREACHABLE — CHECK YOUR CONNECTION. Cleaner continues without AI.", action: "retry" };
    if (msg === "AI_BAD_RESPONSE") return { message: "AI RETURNED AN UNREADABLE RESPONSE — TRY AGAIN.", action: "retry" };
    if (msg === "AI_BLOCKED") return { message: "AI RESPONSE BLOCKED — TRY REPHRASING.", action: "retry" };
    if (msg === "AI_EMPTY") return { message: "AI RETURNED NO TEXT — TRY AGAIN.", action: "retry" };
    return { message: "AI request failed. Check your AI provider configuration.", action: "retry" };
  };

  /**
   * One user action → exactly one user message + exactly one AI request.
   * `appendUser` is false only for RETRY: the failed attempt's message is
   * already on screen, so re-sending must NOT append it a second time.
   */
  const runQuestion = useCallback(async (question: string, appendUser: boolean) => {
    if (!aiKey.isConfigured || loading || sendingRef.current) return;
    if (question.length > MAX_QUESTION_LENGTH) {
      setError({ message: `Question too long (${question.length}/${MAX_QUESTION_LENGTH} chars). Please shorten.`, action: "dismiss" });
      return;
    }

    sendingRef.current = true;
    lastQuestionRef.current = question;
    if (appendUser) {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: question,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const config: AIProviderConfig = {
        apiKey: aiKey.apiKey,
        model: aiKey.model,
        provider: aiKey.provider,
      };

      const objectInput = focusObject ? buildAnalysisInput(focusObject) : undefined;

      // Build wallet stats for context
      let walletStats: { knownAssets: number; protected: number; needsReview: number; verifiedCleanup: number; sweepToSui: number; total: number; sampleText: string } | undefined;
      if (!focusObject && objects.length > 0) {
        let knownAssets = 0, protectedCount = 0, needsReview = 0, verifiedCleanup = 0, sweepToSui = 0;
        for (const o of objects) {
          switch (o.classification) {
            case "keep": knownAssets++; break;
            case "protected": protectedCount++; break;
            case "review": case "suspicious": needsReview++; break;
            case "cleanable":
              if (o.cleanupAction === "withdraw") sweepToSui++;
              else verifiedCleanup++;
              break;
          }
        }
        const sample = objects.filter((o) => o.classification !== "keep" || o.cursed).slice(0, 15)
          .map((o) => `${o.name} (${o.classification}, ${o.category}${o.coinBalance ? `, bal: ${o.coinBalance}` : ""})`).join("; ");
        walletStats = { knownAssets, protected: protectedCount, needsReview, verifiedCleanup, sweepToSui, total: objects.length, sampleText: sample };
      }

      // Build conversation history for context
      const history = messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.analysis ? `[Analysis: ${m.analysis.summary}]` : m.content,
      }));

      // Structured wallet intelligence: real scan buckets travel with every
      // question that has wallet data (both wallet and object mode).
      const walletContext = objects.length > 0 ? buildWalletContext(objects) : undefined;

      // Free-text chat: a valid provider reply is shown as-is — no JSON
      // schema stands between the answer and the user.
      const answer = await askChat(question, config, objectInput, walletStats, history, walletContext);

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: answer.text,
        action: answer.action,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(errorFor(msg));
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  }, [aiKey, loading, focusObject, objects, messages]);

  const sendQuestion = useCallback(
    (question: string) => runQuestion(question, true),
    [runQuestion]
  );

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) sendQuestion(input.trim());
    }
  };

  const handleQuickQuestion = (q: string) => sendQuestion(q);

  const handleAnalyzeWallet = () => sendQuestion("Analyze my wallet and tell me what I should keep, clean, or review.");

  const handleRetry = () => {
    const q = lastQuestionRef.current;
    setError(null);
    // The question is already visible from the failed attempt — resend it
    // without appending a duplicate user message, and without tripping on
    // our own client-side throttle for this one deliberate re-fire.
    if (q) {
      resetChatThrottle();
      runQuestion(q, false);
    }
  };

  /**
   * Apply a deterministic SELECT SAFE TO CLEAN action: pre-selects objects
   * for the EXISTING review flow. Trust-but-verify — only ids still present
   * in the current scan and still Cleaner-classified cleanable (never
   * protected) are selected. Never signs, never executes.
   */
  const handleSelectSafe = (msg: ChatMessage) => {
    if (!msg.action || msg.action.type !== "select_safe" || !onSelectMany) return;
    const filtered = filterSelectableSafeIds(msg.action.objectIds, objects);
    if (filtered.length === 0) return;
    onSelectMany(filtered);
    setAppliedActions((prev) => new Set(prev).add(msg.id));
  };

  // --- OFF state ---
  if (!aiKey.isConfigured) {
    return (
      <div className="ai-assist-overlay" onClick={onClose}>
        <div className="ai-assist-panel ai-assist-off" onClick={(e) => e.stopPropagation()}>
          <div className="ai-assist-header">
            <span className="ai-assist-broom">🧹</span>
            <span className="ai-assist-title">CLEANER AI</span>
            <button className="ai-assist-close" onClick={onClose}>×</button>
          </div>
          <div className="ai-assist-body">
            <p className="ai-assist-hint">
              AI Assistant is optional.<br />
              Connect your own AI provider to get additional explanations and wallet analysis.
            </p>
            <button
              className="ai-assist-enable-btn"
              onClick={() => { onClose(); onOpenSettings?.(); }}
            >
              <Sparkles size={13} /> ENABLE CLEANER AI
            </button>
          </div>
          <div className="ai-assist-footer-notice">
            AI EXPLAINS · CLEANER RULES DECIDE · YOU SIGN
          </div>
        </div>
      </div>
    );
  }

  // --- ONLINE state ---
  const inputLength = input.length;
  const isOverLimit = inputLength > MAX_QUESTION_LENGTH;

  return (
    <div className="ai-assist-overlay" onClick={onClose}>
      <div className="ai-assist-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ai-assist-header">
          <span className="ai-assist-broom">🧹</span>
          <span className="ai-assist-title">CLEANER AI</span>
          <span className="ai-assist-status">
            <span className="ai-assist-status-dot" />
            ONLINE
          </span>
          <button className="ai-assist-close" onClick={onClose}>×</button>
        </div>

        {/* Mode indicator */}
        <div className="ai-assist-mode">
          {focusObject ? (
            <>
              <span className="ai-assist-mode-label">OBJECT ANALYSIS</span>
              <span className="ai-assist-mode-name">{focusObject.name}</span>
              <span className="ai-assist-mode-type">{focusObject.category.toUpperCase()}</span>
            </>
          ) : (
            <>
              <span className="ai-assist-mode-label">WALLET ANALYSIS</span>
              <span className="ai-assist-mode-name">{objects.length} objects detected</span>
            </>
          )}
        </div>

        {/* Safety notice */}
        <div className="ai-assist-safety">
          <span>AI EXPLAINS · CLEANER RULES DECIDE · YOU SIGN</span>
          <span className="ai-assist-privacy">Stored locally · sent to your AI provider per request</span>
        </div>

        {/* Messages — this area scrolls, never the whole window */}
        <div className="ai-assist-messages" ref={messagesBoxRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`ai-msg ${msg.role}`}>
              {msg.role === "assistant" && (
                <div className="ai-msg-avatar">🧹</div>
              )}
              <div className="ai-msg-body">
                {msg.analysis ? (
                  <div className="ai-analysis-card">
                    <div className="ai-card-header">
                      <span className="ai-card-title">🧹 AI ANALYSIS</span>
                    </div>

                    {msg.analysis.whatIsIt && (
                      <div className="ai-card-section">
                        <span className="ai-card-label">WHAT IT IS</span>
                        <p className="ai-card-text">{msg.analysis.whatIsIt}</p>
                      </div>
                    )}

                    {msg.analysis.whyIsItHere && (
                      <div className="ai-card-section">
                        <span className="ai-card-label">WHY IT IS HERE</span>
                        <p className="ai-card-text">{msg.analysis.whyIsItHere}</p>
                      </div>
                    )}

                    <div className="ai-card-row">
                      <div className="ai-card-half">
                        <span className="ai-card-label">RECOMMENDATION</span>
                        <span className={`ai-card-badge ${verdictBadge(msg.analysis.recommendedAction)}`}>
                          {msg.analysis.recommendedAction}
                        </span>
                      </div>
                      <div className="ai-card-half">
                        <span className="ai-card-label">CONFIDENCE</span>
                        <span className={`ai-card-badge ${confidenceBadge(msg.analysis.confidence)}`}>
                          {msg.analysis.confidence}
                        </span>
                      </div>
                    </div>

                    <div className="ai-card-row">
                      <div className="ai-card-half">
                        <span className="ai-card-label">RISK</span>
                        <span className={`ai-card-badge risk-${msg.analysis.risk.toLowerCase()}`}>
                          {msg.analysis.risk}
                        </span>
                      </div>
                    </div>

                    {msg.analysis.summary && (
                      <div className="ai-card-section">
                        <p className="ai-card-text">{msg.analysis.summary}</p>
                      </div>
                    )}

                    {msg.analysis.evidence.length > 0 && (
                      <div className="ai-card-section">
                        <span className="ai-card-label">EVIDENCE</span>
                        <ul className="ai-card-list">
                          {msg.analysis.evidence.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                      </div>
                    )}

                    {msg.analysis.warnings.length > 0 && (
                      <div className="ai-card-warnings">
                        <span className="ai-card-label">⚠ WARNINGS</span>
                        <ul className="ai-card-list">
                          {msg.analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Action buttons */}
                    {focusObject && msg.analysis.recommendedAction !== "PROTECTED" && (
                      <div className="ai-card-actions">
                        {msg.analysis.recommendedAction === "SAFE_TO_CLEAN" && onSelectForCleanup && (
                          <button
                            className="ai-card-action-btn primary"
                            onClick={() => onSelectForCleanup(focusObject.objectId)}
                          >
                            SELECT FOR CLEANUP
                          </button>
                        )}
                        {msg.analysis.recommendedAction === "KEEP" && onKeep && (
                          <button
                            className="ai-card-action-btn secondary"
                            onClick={() => onKeep(focusObject.objectId)}
                          >
                            KEEP
                          </button>
                        )}
                        {msg.analysis.recommendedAction === "REVIEW" && (
                          <span className="ai-card-action-hint">REVIEW IN CLEANER</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="ai-msg-text">{msg.content}</p>
                    {msg.role === "assistant" && msg.action?.type === "select_safe" && onSelectMany && (
                      <div className="ai-card-actions">
                        <button
                          className="ai-card-action-btn primary"
                          disabled={appliedActions.has(msg.id)}
                          onClick={() => handleSelectSafe(msg)}
                        >
                          {appliedActions.has(msg.id) ? "SELECTED FOR REVIEW" : msg.action.label}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-msg assistant">
              <div className="ai-msg-avatar">🧹</div>
              <div className="ai-msg-body">
                <div className="ai-msg-loading">
                  <span className="ai-loading-broom">🧹</span>
                  <span>ANALYZING…</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="ai-msg-error" role="alert">
              <span>{error.message}</span>
              {error.action === "settings" ? (
                <button className="ai-msg-retry" onClick={() => { onClose(); onOpenSettings?.(); }}>
                  OPEN AI SETTINGS
                </button>
              ) : error.action === "retry" ? (
                <button className="ai-msg-retry" onClick={handleRetry}>
                  RETRY
                </button>
              ) : (
                <button className="ai-msg-retry" onClick={() => setError(null)}>DISMISS</button>
              )}
            </div>
          )}
        </div>

        {/* Quick questions - always visible */}
        <div className="ai-assist-quick">
          <div className="ai-assist-quick-grid">
            {quickQuestions.map((q) => (
              <button key={q} className="ai-assist-quick-btn" onClick={() => handleQuickQuestion(q)} disabled={loading}>
                {q}
              </button>
            ))}
            <button className="ai-assist-quick-btn wallet" onClick={handleAnalyzeWallet} disabled={loading}>
              🧹 ANALYZE MY WALLET
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="ai-assist-input-area">
          <input
            ref={inputRef}
            className={`ai-assist-input ${isOverLimit ? "over-limit" : ""}`}
            type="text"
            placeholder="Ask Cleaner AI..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            maxLength={MAX_QUESTION_LENGTH + 100}
          />
          <button
            className="ai-assist-send"
            onClick={() => input.trim() && sendQuestion(input.trim())}
            disabled={!input.trim() || loading || isOverLimit}
          >
            ➤
          </button>
        </div>

        {inputLength > MAX_QUESTION_LENGTH * 0.8 && (
          <div className={`ai-assist-char-count ${isOverLimit ? "over" : ""}`}>
            {inputLength}/{MAX_QUESTION_LENGTH}
          </div>
        )}
      </div>
    </div>
  );
}
