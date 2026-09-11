import { useMemo, useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Coins, ArrowRight, Wallet, RefreshCw } from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";
import { deriveWalletHealth, deriveActionGroups } from "../../scanner/objectClassifier";
import { OBJECT_FILTER_EVENT, type ObjectFilter } from "./WalletObjectsTable";

interface VaultBannerProps {
  address?: string | null;
  objects: WalletObject[];
  cleanableCount: number;
  totalRebateSui: string;
  onQuickClean?: () => void;
  onReviewClean?: () => void;
  hasSelection?: boolean;
  onConnect?: () => void;
  onDemo?: () => void;
  onScanAddress?: (address: string) => void;
  /** wallet monitor: re-run the current scan (no backend, no notifications) */
  onRescan?: () => void;
  lastScannedAt?: number | null;
}

function shortAddr(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgoLabel(ts?: number | null): string {
  if (!ts) return "Just now";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function VaultBanner({
  address,
  objects,
  cleanableCount,
  totalRebateSui,
  onQuickClean,
  onReviewClean,
  hasSelection,
  onConnect,
  onDemo,
  onScanAddress,
  onRescan,
  lastScannedAt,
}: VaultBannerProps) {
  const [copied, setCopied] = useState(false);
  const [showScoreWhy, setShowScoreWhy] = useState(false);

  // Scan facts — every number is derived from the real scan (no fake data).
  // The score reuses the deterministic walletCondition via deriveWalletHealth.
  const stats = useMemo(() => {
    const health = deriveWalletHealth(objects);
    const groups = deriveActionGroups(objects);
    const purity = health.score;
    return {
      total: health.total,
      cleanable: cleanableCount,
      health,
      groups,
      purity,
      rawCondition: health.score,
    };
  }, [objects, cleanableCount]);

  /** action boxes jump to the matching object-table filter (existing mechanism) */
  const jumpToFilter = useCallback((filter: ObjectFilter) => {
    window.dispatchEvent(new CustomEvent(OBJECT_FILTER_EVENT, { detail: filter }));
  }, []);

  const handleCopy = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  // REVIEW & CLEAN opens the review of the CURRENT selection — it never
  // silently selects everything on its own (bulk actions live in the table).
  const handleReviewCleanClick = useCallback(() => {
    if (onReviewClean) onReviewClean();
    else if (onQuickClean && hasSelection) onQuickClean();
  }, [onReviewClean, onQuickClean, hasSelection]);

  // Circular gauge calculations (r=28 -> circumference ~175.93)
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.purity / 100) * circumference;

  const [addrInput, setAddrInput] = useState("");

  if (!address && objects.length === 0) {
    return (
      <div className="vault-overview-wrapper" data-testid="vault-overview">
        <div className="vault-connect-hero">
          <div className="vch-badge">SUI CLEANER</div>
          <h1 className="vch-title">Sui Cleaner</h1>
          <p className="vch-desc">
            Analyze your Sui wallet, identify empty and reclaimable objects, and review potential storage rebates before signing any transaction.
          </p>
          <div className="vch-actions">
            {onConnect && (
              <button className="vch-btn-pri" type="button" onClick={onConnect}>
                <Wallet size={15} strokeWidth={2.2} />
                <span>Connect Wallet</span>
              </button>
            )}
            {onDemo && (
              <button className="vch-btn-sec" type="button" onClick={onDemo}>
                <span>Try Demo</span>
              </button>
            )}
          </div>
          {onScanAddress && (
            <div className="vch-scan-row">
              <input
                type="text"
                placeholder="Or inspect any public Sui address: 0x…"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addrInput.trim() && onScanAddress(addrInput.trim())}
                className="vch-scan-input"
                aria-label="Inspect public Sui address"
              />
              <button
                type="button"
                className="vch-scan-submit"
                onClick={() => addrInput.trim() && onScanAddress(addrInput.trim())}
              >
                Scan
              </button>
            </div>
          )}
          <div className="vch-workflow-hints">
            <span className="vch-step">1. Connect Wallet</span>
            <span className="vch-step-arrow">→</span>
            <span className="vch-step">2. Scan Objects</span>
            <span className="vch-step-arrow">→</span>
            <span className="vch-step">3. Review Items</span>
            <span className="vch-step-arrow">→</span>
            <span className="vch-step">4. Clean &amp; Reclaim</span>
          </div>
        </div>
      </div>
    );
  }

  const purityColor =
    stats.purity > 70 ? "#22c55e" : stats.purity > 40 ? "#38bdf8" : stats.purity > 20 ? "#f59e0b" : "#fb7185";

  return (
    <div className="vault-overview-wrapper" data-testid="vault-overview">
      {/* 1. TOP CARD: WALLET + PURITY + COMPACT STATS */}
      <div className="wallet-overview-card">
        {/* Left: Your Wallet */}
        <div className="wo-wallet-col">
          <div className="wo-label">YOUR WALLET</div>
          {address ? (
            <div className="wo-address-row">
              <span className="wo-address" title={address}>
                {shortAddr(address)}
              </span>
              <button
                type="button"
                className={`wo-icon-btn ${copied ? "copied" : ""}`}
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy address"}
                aria-label="Copy address"
              >
                {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={2} />}
              </button>
              <a
                className="wo-icon-btn"
                href={`https://suiscan.xyz/mainnet/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Suiscan"
                aria-label="View on Suiscan"
              >
                <ExternalLink size={12} strokeWidth={2} />
              </a>
            </div>
          ) : (
            <div className="wo-address demo" title="Fictional Demo Wallet">
              0x30a2...90ef <span className="demo-tag">DEMO</span>
            </div>
          )}
          <div className="wo-scan-time">Last scan: {timeAgoLabel(lastScannedAt)}</div>
          {onRescan && (
            <button
              type="button"
              className="wo-rescan-btn"
              onClick={onRescan}
              title="Re-scan this wallet for new spam (read-only, no backend)"
            >
              <RefreshCw size={12} strokeWidth={2.2} />
              <span>Scan for new spam</span>
            </button>
          )}
        </div>

        {/* Center: Cleanup Score (secondary) — real scan metrics stay primary */}
        <div className="wo-purity-col">
          <div className="wo-gauge-wrap">
            <svg className="wo-gauge-svg" width="68" height="68" viewBox="0 0 68 68">
              <circle
                className="wo-gauge-track"
                cx="34"
                cy="34"
                r={radius}
                strokeWidth="5"
                fill="transparent"
              />
              <circle
                className="wo-gauge-bar"
                cx="34"
                cy="34"
                r={radius}
                strokeWidth="5"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke={purityColor}
              />
            </svg>
            <span className="wo-gauge-text" title="Cleanup Score — algorithmic indicator, not an official Sui metric">
              {stats.purity}
            </span>
          </div>

          <div className="wo-purity-info">
            <div className="wo-label">CLEANUP SCORE</div>
            <div className="wo-health-score" data-testid="cleanup-score">
              Cleanup Score: {stats.health.score} / 100
            </div>
            <div className="wo-purity-track">
              <div
                className="wo-purity-fill"
                style={{ width: `${stats.purity}%`, backgroundColor: purityColor }}
              />
            </div>
            <div className="wo-purity-title">
              {stats.purity >= 80 ? "Little cleanup potential" : stats.purity >= 50 ? "Some cleanup potential." : "High cleanup potential."}
            </div>
            <div className="wo-purity-sub">
              {stats.groups.cleanup} of {stats.total} objects are cleanup candidates
            </div>
            <button
              type="button"
              className="wo-score-why-btn"
              onClick={() => setShowScoreWhy((v) => !v)}
              aria-expanded={showScoreWhy}
              title="How this score is calculated"
            >
              {showScoreWhy ? "− Why this score?" : "+ Why this score?"}
            </button>
            {showScoreWhy && (
              <div className="wo-score-why" data-testid="cleanup-score-why">
                <ul className="why-list">
                  <li>{stats.groups.cleanup} cleanup candidates detected by the current cleanup rules</li>
                  <li>{stats.groups.emptyOrDust} empty or low-value objects</li>
                  <li>{stats.groups.review} objects need your review</li>
                  <li>{stats.groups.keep + stats.groups.protectedCount} objects kept or protected</li>
                </ul>
                <p className="wo-score-why-note">
                  Starts at 100, minus 2 per spam-flagged object, 1 per object needing review,
                  and 1 per 6 cleanable objects (min 25, max 99). An algorithmic cleanup
                  indicator — not an official Sui metric. It is not an amount of SUI,
                  nor a safety or quality rating.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: decision system — what to DO with each object (real counts).
            Click a box to jump to the matching object-table filter. */}
        <div className="wo-stats-grid wo-health-grid" data-testid="action-groups">
          <button
            type="button"
            className="wo-stat-box wo-action-box"
            onClick={() => jumpToFilter("all")}
            title="All detected objects — every decision group"
          >
            <span className="wo-stat-num">{stats.total}</span>
            <span className="wo-stat-lbl">OBJECTS</span>
          </button>

          <button
            type="button"
            className="wo-stat-box wo-action-box cleanable"
            onClick={() => jumpToFilter("cleanable")}
            title="Cleanup candidates — may be removable under the current rules. Candidate ≠ guaranteed safe deletion."
          >
            <span className="wo-stat-num stat-cleanable">{stats.groups.cleanup}</span>
            <span className="wo-stat-lbl">CLEANUP</span>
          </button>

          <button
            type="button"
            className="wo-stat-box wo-action-box review"
            onClick={() => jumpToFilter("review")}
            title="Objects that need your review before any action."
          >
            <span className="wo-stat-num stat-review">{stats.groups.review}</span>
            <span className="wo-stat-lbl">REVIEW</span>
          </button>

          <button
            type="button"
            className="wo-stat-box wo-action-box"
            onClick={() => jumpToFilter("keep")}
            title="Active or important objects — recommended to keep."
          >
            <span className="wo-stat-num stat-keep">{stats.groups.keep}</span>
            <span className="wo-stat-lbl">KEEP</span>
          </button>

          <button
            type="button"
            className="wo-stat-box wo-action-box protected"
            onClick={() => jumpToFilter("protected")}
            title="Objects that cannot be cleaned by the current cleanup flow."
          >
            <span className="wo-stat-num stat-protected">{stats.groups.protectedCount}</span>
            <span className="wo-stat-lbl">PROTECTED</span>
          </button>
        </div>
      </div>

      {/* 2. PROMINENT BANNER: ESTIMATED RECOVERY + MAIN CTA */}
      <div className="estimated-recovery-banner">
        <div className="rec-left">
          <div className="rec-icon-wrap" aria-hidden="true">
            <Coins size={22} strokeWidth={2} />
          </div>

          <div className="rec-content">
            <div className="rec-title">ESTIMATED RECOVERY</div>
            <div className={`rec-amount ${Number(totalRebateSui) > 0 ? "" : "zero"}`}>
              {Number(totalRebateSui) > 0 ? `+${totalRebateSui} SUI` : "0.0000 SUI"}
            </div>
            <div className="rec-sub">
              Estimated storage rebate from deletions that actually free storage (NFT burns return none).
              Actual recovery depends on the objects removed and the resulting transaction.
            </div>
          </div>
        </div>

        <div className="rec-right">
          <button
            type="button"
            className="rec-cta-btn"
            onClick={handleReviewCleanClick}
            title="Review cleanable objects before signing"
          >
            <span>REVIEW &amp; CLEAN</span>
            <ArrowRight size={14} strokeWidth={2.2} />
          </button>
          <div className="rec-cta-sub">Review objects before signing.</div>
        </div>
      </div>
    </div>
  );
}
