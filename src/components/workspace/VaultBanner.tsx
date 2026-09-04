import { useMemo, useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Coins, ArrowRight, Wallet, Search } from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";
import { walletCondition } from "../../scanner/objectClassifier";

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
}

function shortAddr(addr: string) {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
}: VaultBannerProps) {
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const total = objects.length;
    const cleanable = cleanableCount;
    const review = objects.filter((o) => o.classification === "review" || o.classification === "suspicious").length;
    const protectedCount = objects.filter((o) => o.protected).length;
    const keepCount = objects.filter((o) => o.classification === "keep").length;
    const suspiciousCount = objects.filter((o) => o.classification === "suspicious").length;

    // Wallet purity calculation
    const rawCondition =
      total > 0
        ? walletCondition({
            total,
            keep: keepCount,
            review,
            suspicious: suspiciousCount,
            cleanable,
            protected: protectedCount,
            valuable: 0,
            trusted: 0,
            byKind: { nft: 0, token: 0, object: 0 },
            estimatedValueUsd: 0,
          })
        : 100;

    // In demo or cases where cleanable ratio is high, calculate clean visual purity
    const cleanableRatio = total > 0 ? (cleanable + suspiciousCount) / total : 0;
    const purity = Math.max(5, Math.min(100, Math.round((1 - cleanableRatio) * 100)));
    const storageTakingPercent = 100 - purity;

    return {
      total,
      cleanable,
      review,
      protectedCount,
      purity,
      rawCondition,
      storageTakingPercent,
    };
  }, [objects, cleanableCount]);

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
          <div className="wo-scan-time">Last scan: Just now</div>
        </div>

        {/* Center: Wallet Purity with Circular Gauge */}
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
            <span className="wo-gauge-text">{stats.purity}%</span>
          </div>

          <div className="wo-purity-info">
            <div className="wo-label">WALLET PURITY</div>
            <div className="wo-purity-track">
              <div
                className="wo-purity-fill"
                style={{ width: `${stats.purity}%`, backgroundColor: purityColor }}
              />
            </div>
            <div className="wo-purity-title">
              {stats.purity >= 80 ? "Wallet is well optimized" : "Your wallet can be optimized."}
            </div>
            <div className="wo-purity-sub">
              {stats.storageTakingPercent}% of objects are taking up storage
            </div>
          </div>
        </div>

        {/* Right: Compact Statistics Grid */}
        <div className="wo-stats-grid">
          <div className="wo-stat-box">
            <div className="wo-stat-num">{stats.total}</div>
            <div className="wo-stat-lbl">TOTAL OBJECTS</div>
          </div>

          <div className="wo-stat-box cleanable">
            <div className="wo-stat-num stat-cleanable">{stats.cleanable}</div>
            <div className="wo-stat-lbl">CLEANABLE</div>
          </div>

          <div className="wo-stat-box review">
            <div className="wo-stat-num stat-review">{stats.review}</div>
            <div className="wo-stat-lbl">REVIEW</div>
          </div>

          <div className="wo-stat-box protected">
            <div className="wo-stat-num stat-protected">{stats.protectedCount}</div>
            <div className="wo-stat-lbl">PROTECTED</div>
          </div>
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
