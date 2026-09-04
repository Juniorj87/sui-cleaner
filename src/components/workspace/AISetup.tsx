/**
 * AISetup — AI provider settings panel.
 *
 * Features:
 *   - Smart key detection (AIza... free vs AQ... paid)
 *   - Unified SAVE+TEST flow (one click to validate and save)
 *   - Step-by-step guidance for billing / key issues
 *   - Provider + model selection
 *   - Key management (change, remove)
 *   - localStorage for key persistence
 *
 * Security: key stays in the browser localStorage and is sent to the
 * same-origin /api/ai/* relay (then the chosen AI provider) per request.
 * Never persisted or logged server-side.
 */

import { useState } from "react";
import { Sparkles, Lock } from "lucide-react";
import type { UseAIKeyReturn } from "../../ai/useAIKey";
import type { AIProviderName } from "../../ai/provider";
import { PROVIDER_META } from "../../ai/provider";

interface KeyValidation {
  ok: boolean;
  error?: string;
  hint?: string;
  steps?: string[];
  setupUrl?: string;
}

export default function AISetup({ aiKey, onClose }: { aiKey: UseAIKeyReturn; onClose?: () => void }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<KeyValidation | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(!aiKey.isConfigured);

  const meta = PROVIDER_META[aiKey.provider];

  /** Detect key type from pasted input */
  const detectKeyType = (key: string): "paid" | "free" | "unknown" | null => {
    const t = key.trim();
    if (!t) return null;
    if (t.startsWith("AQ.")) return "paid";
    if (t.startsWith("AIza")) return "free";
    return "unknown";
  };

  const keyType = detectKeyType(input);

  /** Unified save-and-test: validates key then saves if valid */
  const handleSaveAndTest = async () => {
    const key = input.trim();
    if (!key) return;
    setSaving(true);
    setValidation(null);
    try {
      const ok = await aiKey.testKey(key);
      if (ok) {
        aiKey.saveKey(key, aiKey.provider, aiKey.model);
        setInput("");
        setShowKeyInput(false);
        setValidation({ ok: true });
      } else {
        setValidation({ ok: false, error: aiKey.error || "Key validation failed." });
      }
    } catch {
      setValidation({ ok: false, error: "Cannot reach AI service. Check your connection." });
    }
    setSaving(false);
  };

  const handleRemove = () => {
    aiKey.removeKey();
    setValidation(null);
    setInput("");
    setShowKeyInput(true);
  };

  const handleProviderChange = (p: AIProviderName) => {
    aiKey.setProvider(p);
    setValidation(null);
  };

  const handleModelChange = (m: string) => {
    aiKey.setModel(m);
  };

  const isConfigured = aiKey.isConfigured;

  /** Mask API key for display */
  const maskKey = (key: string) => {
    if (!key || key.length < 8) return "••••••••";
    return key.slice(0, 4) + "•".repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
  };

  return (
    <div className="ai-setup">
      {/* Header */}
      <div className="ai-setup-header">
        <span className="ai-setup-icon" aria-hidden="true"><Sparkles size={18} /></span>
        <span className="ai-setup-title">CLEANER AI SETTINGS</span>
        {onClose && (
          <button className="ai-setup-close-inline" onClick={onClose} aria-label="Close">×</button>
        )}
      </div>

      <p className="ai-setup-desc">
        Connect your own AI provider to get deeper explanations and wallet analysis.
      </p>

      {/* Security badge */}
      <div className="ai-setup-security">
        <span className="ai-setup-lock" aria-hidden="true"><Lock size={14} /></span>
        <span>YOUR KEY IS STORED ONLY IN THIS BROWSER</span>
      </div>
      <p className="ai-setup-security-note">
        Sent to your AI provider only when you make a request. Never stored or logged by Sui Cleaner servers.
      </p>

      {/* Provider selector */}
      <div className="ai-setup-section">
        <label className="ai-setup-label">PROVIDER</label>
        <div className="ai-setup-provider-grid">
          {(Object.keys(PROVIDER_META) as AIProviderName[]).map((name) => (
            <button
              key={name}
              className={`ai-setup-provider-btn ${aiKey.provider === name ? "active" : ""}`}
              onClick={() => handleProviderChange(name)}
            >
              {PROVIDER_META[name].name}
              {PROVIDER_META[name].free && <span className="ai-setup-free-badge">FREE</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Model selector */}
      <div className="ai-setup-section">
        <label className="ai-setup-label">MODEL</label>
        <select
          className="ai-setup-select"
          value={aiKey.model}
          onChange={(e) => handleModelChange(e.target.value)}
        >
          {meta.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* === CONFIGURED STATE === */}
      {isConfigured && !showKeyInput ? (
        <>
          <div className="ai-setup-section">
            <label className="ai-setup-label">API KEY</label>
            <div className="ai-setup-key-display">
              <span className="ai-setup-key-masked">{maskKey(aiKey.apiKey)}</span>
              <div className="ai-setup-key-actions">
                <button className="ai-setup-key-btn" onClick={() => setShowKeyInput(true)}>
                  CHANGE KEY
                </button>
                <button className="ai-setup-key-btn danger" onClick={handleRemove}>
                  REMOVE KEY
                </button>
              </div>
            </div>
          </div>

          <div className="ai-setup-configured">
            <span className="ai-setup-ready-dot" />
            <span className="ai-setup-ready-text">AI READY</span>
            <span className="ai-setup-provider-badge">{meta.name}</span>
          </div>

          {validation?.ok && (
            <p className="ai-setup-success">✓ Connection verified. AI is ready.</p>
          )}
        </>
      ) : (
        <>
          {/* === INPUT STATE === */}

          {/* Gemini-specific key guidance */}
          {aiKey.provider === "gemini" && (
            <div className="ai-setup-guidance">
              <div className="ai-setup-guidance-header">
                <span className="ai-setup-guidance-icon">💡</span>
                <span>GOOGLE GEMINI KEY TIPS</span>
              </div>
              <ul className="ai-setup-guidance-list">
                <li className="ai-setup-guidance-item paid">
                  <span className="ai-setup-guidance-dot paid" />
                  <span><strong>Paid key (AQ...)</strong> — Most reliable. Requires Google Cloud billing enabled.</span>
                </li>
                <li className="ai-setup-guidance-item free">
                  <span className="ai-setup-guidance-dot free" />
                  <span><strong>Free key (AIza...)</strong> — May be unstable or rate-limited.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Smart detection: user pasted a free key */}
          {keyType === "free" && (
            <div className="ai-setup-warning-box">
              <div className="ai-setup-warning-header">
                <span className="ai-setup-warning-icon">⚠️</span>
                <span>FREE KEY DETECTED</span>
              </div>
              <p className="ai-setup-warning-text">
                You pasted a free AI Studio key. These keys may be unstable and can fail
                unexpectedly. For the best experience, use a paid Google Cloud key.
              </p>
              <a
                className="ai-setup-guidance-link"
                href="https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com"
                target="_blank"
                rel="noreferrer"
              >
                → Open Google Cloud Console to create a paid key
              </a>
            </div>
          )}

          {/* Key input */}
          <div className="ai-setup-section">
            <label className="ai-setup-label">API KEY</label>
            <div className="ai-setup-input-wrap">
              <input
                className={`ai-setup-input ${keyType === "free" ? "input-warning" : ""} ${keyType === "paid" ? "input-ok" : ""}`}
                type="password"
                placeholder={meta.placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveAndTest()}
                autoFocus
              />
              {keyType === "paid" && (
                <span className="ai-setup-input-hint ok">✓ Paid key detected (AQ...)</span>
              )}
              {keyType === "free" && (
                <span className="ai-setup-input-hint warn">⚠ Free key — may be unstable</span>
              )}
            </div>
          </div>

          {/* Single SAVE button — validates + saves in one step */}
          <div className="ai-setup-actions">
            <button
              className="ai-setup-save-btn"
              onClick={handleSaveAndTest}
              disabled={!input.trim() || saving}
              style={{ flex: 1 }}
              type="button"
            >
              {saving ? "VALIDATING…" : "SAVE & VERIFY"}
            </button>
          </div>

          {/* Validation error with step-by-step guidance */}
          {validation && !validation.ok && (
            <div className="ai-setup-error-box">
              <div className="ai-setup-error-header">
                <span className="ai-setup-error-icon">✕</span>
                <span>{validation.error || "Validation failed"}</span>
              </div>

              {/* Step-by-step instructions */}
              {validation.steps && validation.steps.length > 0 && (
                <div className="ai-setup-steps">
                  <p className="ai-setup-steps-title">How to fix:</p>
                  <ol className="ai-setup-steps-list">
                    {validation.steps.map((step, i) => (
                      <li key={i} className="ai-setup-steps-item">{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Direct link */}
              {validation.setupUrl && (
                <a
                  className="ai-setup-guidance-link"
                  href={validation.setupUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  → Open Google Cloud Console
                </a>
              )}
            </div>
          )}

          {/* Fallback link */}
          {aiKey.provider === "gemini" && (
            <a
              className="ai-setup-link"
              href={meta.keyUrl}
              target="_blank"
              rel="noreferrer"
            >
              GET A {meta.name.toUpperCase()} API KEY →
            </a>
          )}
          {aiKey.provider !== "gemini" && (
            <a
              className="ai-setup-link"
              href={meta.keyUrl}
              target="_blank"
              rel="noreferrer"
            >
              GET A {meta.name.toUpperCase()} API KEY →
            </a>
          )}
        </>
      )}

      <p className="ai-setup-footer">
        AI is optional. Cleaner works perfectly without it.
      </p>
    </div>
  );
}
