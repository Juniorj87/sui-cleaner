import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, Scan, Sparkles, Wallet, LogOut } from "lucide-react";
import { shortAddr } from "../ui";
import { getNetwork } from "../../config";
import type { UseAIKeyReturn } from "../../ai/useAIKey";
import mascotImg from "../../assets/mascot.png";

/**
 * Top bar of the Cleaner workspace.
 * Left: Brand mascot broom + SUI CLEANER title.
 * Right: Network indicator, AI status, connected wallet, and primary action buttons.
 */
export default function AppTopBar({
  account,
  mode,
  onScan,
  onConnect,
  onDisconnect,
  aiKey,
  onToggleAI,
}: {
  account: { address: string } | null;
  mode: "demo" | "onchain" | "readonly" | null;
  onScan: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  aiKey?: UseAIKeyReturn;
  onToggleAI?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddr = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!account?.address) return;
    navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="app-topbar-slim">
      <div className="app-topbar-inner">
        {/* Left: Brand Mascot & Logo */}
        <Link to="/" className="app-topbar-brand" title="Sui Cleaner — Home">
          <img src={mascotImg} alt="Sui Cleaner Mascot" className="app-topbar-mascot" />
          <span className="app-topbar-brand-text">
            SUI <span className="app-topbar-brand-acc">CLEANER</span>
          </span>
        </Link>

        {/* Right: Actions & Status */}
        <div className="app-topbar-actions">
          {mode === "demo" && (
            <span className="app-topbar-badge demo-badge">DEMO MODE</span>
          )}
          {mode === "readonly" && (
            <span className="app-topbar-badge readonly-badge">READ-ONLY</span>
          )}

          {/* Network Indicator - Compact Status Pill */}
          <div className="app-topbar-net" title="Connected Sui Network">
            <span className="app-topbar-net-dot" />
            <span>{getNetwork() === "testnet" ? "SUI TESTNET" : "SUI MAINNET"}</span>
          </div>

          {/* AI Assistant Chip - Compact Status Pill */}
          {aiKey && onToggleAI && (
            <button
              className={`app-topbar-ai-btn ${aiKey.isConfigured ? "ready" : "off"}`}
              onClick={onToggleAI}
              title={aiKey.isConfigured ? "Open Cleaner AI Assistant" : "Configure Cleaner AI"}
              type="button"
            >
              <Sparkles size={12} strokeWidth={2.2} className="ai-btn-icon" />
              <span>AI {aiKey.isConfigured ? "READY" : "OFF"}</span>
            </button>
          )}

          {/* Connected Wallet Chip */}
          {account && (
            <button
              type="button"
              className="app-topbar-wallet-chip"
              onClick={handleCopyAddr}
              title="Click to copy address"
            >
              <span className="wallet-chip-dot" />
              <span className="wallet-chip-addr">{shortAddr(account.address)}</span>
              <span className="wallet-chip-copy" title="Copy Address">
                {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
              </span>
            </button>
          )}

          {/* Connect Button (when disconnected and no scan is active) */}
          {!account && !mode && (
            <button className="sc-primary app-topbar-btn-pri app-topbar-connect-btn" data-act="connect" onClick={onConnect} type="button">
              <Wallet size={13} strokeWidth={2.2} />
              <span>CONNECT WALLET</span>
            </button>
          )}

          {/* Scan/Clean Action Button — one primary CTA per state.
              Connected wallet → CLEAN MY WALLET (the main product action).
              Demo / read-only (no wallet) → allowed secondary labels. */}
          {(account || mode) && (
            <button className="sc-primary app-topbar-btn-pri app-topbar-scan-btn" data-act="scan" onClick={onScan} type="button">
              <Scan size={13} strokeWidth={2.4} />
              <span>
                {account
                  ? "CLEAN MY WALLET"
                  : mode === "demo"
                    ? "TRY DEMO"
                    : mode === "readonly"
                      ? "SCAN ADDRESS"
                      : "CLEAN MY WALLET"}
              </span>
            </button>
          )}

          {/* Disconnect Button (when connected) - Subtle Secondary */}
          {account && (
            <button className="sc-secondary app-topbar-btn-sec" data-act="disconnect" onClick={onDisconnect} type="button" title="Disconnect wallet">
              <LogOut size={12} strokeWidth={2} />
              <span>DISCONNECT</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
