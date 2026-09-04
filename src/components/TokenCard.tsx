/**
 * TOKEN CARD — premium token display card.
 *
 * Shows a token with its pixel-art icon, name, symbol, balance, and status.
 * Designed to match the SUI CLEANER cinematic dark theme.
 */

import type { CSSProperties } from "react";
import type { GroupStatus } from "../lib/walletGroups";
import type { WalletObject } from "../scanner/objectClassifier";
import {
  findProjectByCoinType,
  findProjectByName,
  findProjectByPackage,
  findProjectByCollection,
  type ProjectIdentity,
} from "../data/projectRegistry";

function identityFor(o: WalletObject): ProjectIdentity | undefined {
  const inner = o.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  return (
    (inner ? findProjectByCoinType(inner) : undefined) ??
    (o.name ? findProjectByName(o.name) : undefined) ??
    (o.package ? findProjectByPackage(o.package) : undefined) ??
    (o.collection ? findProjectByCollection(o.collection) : undefined)
  );
}

function iconStatus(o: WalletObject): GroupStatus {
  if (o.protected) return "protected";
  if (o.cleanupAction) return "cleanable";
  if (o.classification === "keep") return "keep";
  return "review";
}

export interface TokenCardProps {
  /** Wallet object to display */
  object?: WalletObject;
  /** Token display name */
  name?: string;
  /** Token symbol (SUI, USDC, etc.) */
  symbol?: string;
  /** Issuer / protocol name */
  issuer?: string;
  /** Token balance */
  balance?: string;
  /** USD value */
  value?: string;
  /** Status: keep, protected, review, cleanable */
  status?: GroupStatus;
  /** Category: coin, nft, object */
  category?: string;
  /** Whether the token identity is known */
  known?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional additional CSS class */
  className?: string;
  /** Optional inline styles */
  style?: CSSProperties;
  /** Compact mode */
  compact?: boolean;
}

const STATUS_COLORS: Record<GroupStatus, { bg: string; border: string; text: string }> = {
  keep: { bg: "rgba(70, 181, 140, 0.08)", border: "rgba(70, 181, 140, 0.3)", text: "#46b58c" },
  protected: { bg: "rgba(47, 181, 163, 0.08)", border: "rgba(47, 181, 163, 0.3)", text: "#2fb5a3" },
  review: { bg: "rgba(217, 164, 65, 0.08)", border: "rgba(217, 164, 65, 0.3)", text: "#d9a441" },
  cleanable: { bg: "rgba(70, 181, 140, 0.08)", border: "rgba(70, 181, 140, 0.3)", text: "#46b58c" },
};

/**
 * A single token card with pixel art icon and glass panel design.
 */
export function TokenCard({
  object,
  name,
  symbol,
  issuer: _issuer,
  balance,
  value: _value,
  status,
  category = "coin",
  known = true,
  onClick,
  className,
  style,
  compact = false,
}: TokenCardProps) {
  // If object is provided, derive values from it
  const identity = object ? identityFor(object) : undefined;
  const objStatus = object ? iconStatus(object) : status ?? "review";

  const displayName = name ?? object?.name ?? "Unknown";
  const displaySymbol = symbol ?? identity?.symbol ?? displayName.slice(0, 4).toUpperCase();
  const displayCategory = category ?? (object?.category === "coin" ? "coin" : object?.category === "nft" ? "nft" : "object");
  const isKnown = known ?? !!identity;

  let displayBalance = balance;

  if (object && !displayBalance) {
    if (object.category === "coin") {
      displayBalance = object.coinBalance === "0" ? "0" : object.coinBalance ?? "—";
    } else {
      displayBalance = "—";
    }
  }

  const sc = STATUS_COLORS[objStatus];

  return (
    <div
      className={`token-card ${compact ? "token-card-compact" : ""} ${className ?? ""}`}
      onClick={onClick}
      style={{
        background: "rgba(18, 18, 24, 0.45)",
        backdropFilter: "blur(18px) saturate(120%)",
        WebkitBackdropFilter: "blur(18px) saturate(120%)",
        border: `1px solid ${sc.border}`,
        borderRadius: "24px",
        padding: "24px 26px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 12px 40px rgba(0, 0, 0, 0.4), 0 0 20px ${sc.border}`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Subtle glow overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 30%, ${sc.bg}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Category Indicator */}
      <div style={{ flexShrink: 0, width: "32px", height: "32px", borderRadius: "8px", background: sc.bg, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: sc.text, fontSize: "14px", fontWeight: "bold" }}>
        {objStatus === "protected" ? "⛨" : objStatus === "review" || !isKnown ? "?" : objStatus === "cleanable" ? "✦" : displayCategory === "nft" ? "◇" : "◆"}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: "13px",
              color: "var(--ivory)",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {displayName}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              fontWeight: 500,
              color: "var(--text-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {displaySymbol}
          </span>
        </div>
      </div>

      {/* Balance */}
      {displayBalance && (
        <div
          style={{
            textAlign: "right",
            position: "relative",
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-sec)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayBalance}
          </span>
        </div>
      )}


    </div>
  );
}

export default TokenCard;
