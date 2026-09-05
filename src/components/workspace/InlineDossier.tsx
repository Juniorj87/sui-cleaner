import { useState, useCallback } from "react";
import {
  Coins,
  Image as ImageIcon,
  Zap,
  TriangleAlert,
  Sparkles,
  Pin,
  Search,
  Box,
  ShieldAlert,
  Check,
  Plus,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";
import { suiscanObjectUrl } from "../../lib/suiscan";
import { getNetwork } from "../../config";
import { isEmptyCoinObject, storageRebateSui } from "../../lib/walletGroups";
import {
  findProjectByCoinType,
  findProjectByName,
  findProjectByPackage,
  findProjectByCollection,
  type ProjectIdentity,
} from "../../data/projectRegistry";
import type { UseAIKeyReturn } from "../../ai/useAIKey";

function identityFor(o: WalletObject): ProjectIdentity | undefined {
  const inner = o.type.match(/^0x2::coin::Coin<(.+)>$/)?.[1];
  return (
    (inner ? findProjectByCoinType(inner) : undefined) ??
    (o.name ? findProjectByName(o.name) : undefined) ??
    (o.package ? findProjectByPackage(o.package) : undefined) ??
    (o.collection ? findProjectByCollection(o.collection) : undefined)
  );
}

type GroupStatus = "keep" | "protected" | "review" | "cleanable";

function iconStatus(o: WalletObject): GroupStatus {
  if (o.protected) return "protected";
  if (o.cleanupAction) return "cleanable";
  if (o.classification === "keep") return "keep";
  return "review";
}

function humanExplanation(o: WalletObject, st: GroupStatus): {
  whatIsIt: string;
  whyIsItHere: string;
  whatCanIDo: string;
} {
  const empty = isEmptyCoinObject(o);

  if (st === "protected") {
    if (/::kiosk::KioskOwnerCap$/.test(o.type)) {
      return {
        whatIsIt: "Kiosk Owner Capability",
        whyIsItHere: "This is the master cryptographic key that controls your Sui Kiosk. Without it, you lose access to all assets inside the kiosk.",
        whatCanIDo: "KEEP — Never remove or burn this capability.",
      };
    }
    if (/staking_pool::StakedSui/i.test(o.type)) {
      return {
        whatIsIt: "Staked SUI Object",
        whyIsItHere: "Your SUI is actively staked with a validator and earning staking rewards.",
        whatCanIDo: "KEEP — Active staking position.",
      };
    }
    return {
      whatIsIt: "System-Protected Object",
      whyIsItHere: "This object is connected to an active position, capability, or protocol. Modifying it could break wallet functionality.",
      whatCanIDo: "KEEP — Cleaner permanently protects this object.",
    };
  }

  if (st === "cleanable") {
    if (empty) {
      return {
        whatIsIt: "Empty 0-Balance Coin Object",
        whyIsItHere: "This coin object previously held tokens, but the entire balance was spent. The empty container still occupies on-chain storage.",
        whatCanIDo: "RECLAIM SUI — Safe to delete via coin::destroy_zero(). Destroying it may return a storage rebate (estimated — the final amount depends on transaction effects).",
      };
    }
    if (o.dust) {
      return {
        whatIsIt: "Micro-Token Dust Balance",
        whyIsItHere: "This coin contains a tiny fraction of tokens not worth holding individually.",
        whatCanIDo: "SWEEP & CONVERT — Consolidate and convert dust into SUI.",
      };
    }
    if (o.classification === "suspicious") {
      return {
        whatIsIt: "Suspicious / Phishing Airdrop",
        whyIsItHere: "Unsolicited airdrop from an unverified package or flagged drainer contract.",
        whatCanIDo: "QUARANTINE & BURN — Safe to burn via transfer to 0x0 to reclaim storage rebate and clean your wallet.",
      };
    }
    return {
      whatIsIt: "Removable Junk Object",
      whyIsItHere: "This object has no active dependencies and can be safely reclaimed for storage rebate.",
      whatCanIDo: "REMOVE & RECLAIM — Verified cleanup action available.",
    };
  }

  if (st === "keep") {
    return {
      whatIsIt: "Active Verified Asset",
      whyIsItHere: "This is a verified token, NFT, or protocol position that belongs to your active portfolio.",
      whatCanIDo: "KEEP — No action required.",
    };
  }

  return {
    whatIsIt: "Unverified Object (Needs Review)",
    whyIsItHere: "This object comes from a package not yet in the verified protocol registry.",
    whatCanIDo: "REVIEW — Cleaner will not touch this object without your explicit review. Inspect on SuiScan or ask AI.",
  };
}

export default function InlineDossier({
  object,
  onBack,
  allObjects,
  isSelected,
  onToggleSelect,
  readonly,
  aiKey,
  onOpenAI,
}: {
  object: WalletObject;
  onBack: () => void;
  allObjects?: WalletObject[];
  isSelected?: boolean;
  onToggleSelect?: (select: boolean) => void;
  readonly?: boolean;
  aiKey?: UseAIKeyReturn;
  onOpenAI?: (obj?: WalletObject) => void;
}) {
  const [showTech, setShowTech] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const identity = identityFor(object);
  const st = iconStatus(object);
  const explanation = humanExplanation(object, st);
  const network = getNetwork();
  const empty = isEmptyCoinObject(object);
  const isSuspicious = object.classification === "suspicious";
  // Honest numbers: only actions that free storage pay a rebate. An NFT / junk
  // object burn (transfer to 0x0) removes the object but returns no storage
  // rebate, and a withdraw recovers value, not a rebate — never quote +0.0020
  // SUI for either.
  const rebateSui = storageRebateSui(object);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }, []);

  const sameTypeCount = allObjects
    ? allObjects.filter((o) => o.type === object.type && isEmptyCoinObject(o)).length
    : 1;

  let balanceDisplay = "";
  if (object.category === "coin") {
    balanceDisplay = empty ? "0 BALANCE" : `${object.coinBalance ?? "?"} ${identity?.symbol ?? object.name}`;
  } else if (object.category === "nft") {
    balanceDisplay = "NFT ASSET";
  } else {
    balanceDisplay = "OBJECT";
  }

  const metaText = identity?.issuer ?? object.collection ?? "Unknown issuer / collection";

  /** technical rows: a missing value shows "Not available" — never an empty
   *  row with a stray Copy button. */
  const techRows: Array<{ label: string; value?: string; copyKey: string; method?: boolean }> = [
    { label: "Object ID", value: object.objectId, copyKey: "objectId" },
    { label: "Package ID", value: object.package || undefined, copyKey: "package" },
    { label: "BCS Move Type", value: object.type || undefined, copyKey: "type" },
    { label: "Digest", value: object.digest, copyKey: "digest" },
    {
      label: "Cleanup Method",
      value:
        object.coinBalance === "0"
          ? "0x2::coin::destroy_zero()"
          : object.cleanupAction
            ? object.cleanupAction === "burn"
              ? "transfer to 0x0 (burn)"
              : object.cleanupAction
            : undefined,
      copyKey: "method",
    },
  ];
  const heroGlyph = empty ? (
    <Coins size={22} strokeWidth={2} />
  ) : object.category === "nft" ? (
    <ImageIcon size={22} strokeWidth={2} />
  ) : object.position ? (
    <Zap size={22} strokeWidth={2} />
  ) : isSuspicious ? (
    <TriangleAlert size={22} strokeWidth={2} />
  ) : (
    <Box size={22} strokeWidth={2} />
  );

  return (
    <div className="ws-dossier" data-dossier="active" data-testid="inline-dossier">
      {/* Back Button */}
      <button className="ws-dossier-back" onClick={onBack} aria-label="Back to inventory">
        <ArrowLeft size={12} strokeWidth={2.2} /> BACK TO INVENTORY
      </button>

      <div className="dossier-card">
        {/* Holographic Header Banner */}
        <div className="dossier-hero">
          <div className="dossier-hero-bg" aria-hidden="true" />
          <div className="dossier-hero-content">
            <div className="dossier-hero-icon">{heroGlyph}</div>

            <div className="dossier-hero-titles">
              <div className="dossier-meta-row">
                <span className="dossier-category">{object.category.toUpperCase()}</span>
                <span className="dossier-issuer">{metaText}</span>
              </div>
              <h2 className="dossier-name">{object.name}</h2>
              <div className="dossier-balance-row">
                <span className={`dossier-balance ${empty ? "empty" : ""}`}>{balanceDisplay}</span>
                {sameTypeCount > 1 && (
                  <span className="dossier-count-sub">({sameTypeCount} matching objects in wallet)</span>
                )}
              </div>
            </div>

            {/* Verdict Stamp */}
            <div className="dossier-stamp-container">
              <span className={`verdict-stamp-new st-${st}`}>
                {st === "keep"
                  ? "KEEP"
                  : st === "protected"
                  ? "PROTECTED"
                  : st === "cleanable"
                  ? empty
                    ? "SAFE TO REMOVE (ESTIMATED REBATE)"
                    : isSuspicious
                    ? "SUSPICIOUS / SPAM"
                    : object.category === "nft"
                    ? "SAFE TO BURN (NO REBATE)"
                    : "SAFE TO CLEAN"
                  : "NEEDS REVIEW"}
              </span>
            </div>
          </div>
        </div>

        {/* Storage Rebate Banner if cleanable */}
        {object.cleanupAction && (
          <div className={`dossier-rebate-banner ${rebateSui > 0 ? "" : "no-rebate"}`}>
            <span className="rebate-banner-icon"><Zap size={14} /></span>
            <div className="rebate-banner-text">
              {object.cleanupAction === "withdraw" ? (
                <>
                  <strong>Value Recovery:</strong> withdrawing this position returns the value it holds to your wallet{" "}
                  — this is a recovery, not a storage rebate.
                </>
              ) : rebateSui > 0 ? (
                <>
                  <strong>Storage Rebate on Clean:</strong> Deleting or burning this object releases{" "}
                  <span className="rebate-highlight">+{rebateSui.toFixed(4)} SUI</span> directly back to your wallet
                  balance.
                </>
              ) : (
                <>
                  <strong>No Storage Rebate on Burn:</strong> burning this{" "}
                  {object.category === "nft" ? "NFT" : "object"} via transfer-to-0x0 removes it from your wallet but
                  returns no storage rebate — cleaning is about tidiness here, not a refund.
                </>
              )}
            </div>
          </div>
        )}

        {/* Plain-English Analysis Cards */}
        <div className="dossier-sections">
          <div className="dossier-section-card">
            <div className="dossier-section-head">
              <Pin size={14} strokeWidth={2} className="dossier-section-icon" />
              <span className="dossier-section-title">WHAT IS IT?</span>
            </div>
            <p className="dossier-section-text">{explanation.whatIsIt}</p>
          </div>

          <div className="dossier-section-card">
            <div className="dossier-section-head">
              <Search size={14} strokeWidth={2} className="dossier-section-icon" />
              <span className="dossier-section-title">WHY IS IT HERE?</span>
            </div>
            <p className="dossier-section-text">{explanation.whyIsItHere}</p>
          </div>

          <div className="dossier-section-card">
            <div className="dossier-section-head">
              <Zap size={14} strokeWidth={2} className="dossier-section-icon" />
              <span className="dossier-section-title">WHAT CAN I DO?</span>
            </div>
            <p className="dossier-section-text">{explanation.whatCanIDo}</p>
          </div>
        </div>

        {/* AI Assistant Callout */}
        {aiKey && onOpenAI && (
          <div className="dossier-ai-callout">
            <div className="ai-callout-left">
              <Sparkles size={14} strokeWidth={2} className="ai-callout-icon" />
              <div>
                <div className="ai-callout-title">Deep AI Object Analysis</div>
                <div className="ai-callout-sub">Ask Cleaner AI to inspect package bytecode, contract history, and safety.</div>
              </div>
            </div>
            <button className="ai-ask-btn" onClick={() => onOpenAI(object)}>
              <Sparkles size={13} strokeWidth={2} />
              ASK CLEANER AI
            </button>
          </div>
        )}

        {/* Technical Details Accordion */}
        <div className="dossier-tech-container">
          <button
            className="tech-toggle-new"
            onClick={() => setShowTech((v) => !v)}
            aria-expanded={showTech}
          >
            <span>{showTech ? "− Hide Technical Details" : "+ Show Technical Details (BCS & On-Chain Facts)"}</span>
            <span className="tech-toggle-sub">Object ID, Package, Move Type, Move Method</span>
          </button>

          {showTech && (
            <div className="tech-details-new">
              {techRows.map(({ label, value, copyKey }) => {
                const present = !!value && value !== "—";
                return (
                  <div className="tech-row-new" key={copyKey}>
                    <span className="tech-key">{label}</span>
                    <div className="tech-value-wrap">
                      <span
                        className={`tech-value-new mono-sm ${present ? "" : "na"}`}
                        title={present ? value : undefined}
                      >
                        {present ? value : "Not available"}
                      </span>
                      {present && (
                        <button
                          className={`tech-copy-btn ${copiedKey === copyKey ? "copied" : ""}`}
                          onClick={() => handleCopy(value as string, copyKey)}
                          title={`Copy ${label} to clipboard`}
                          aria-label={`Copy ${label} to clipboard`}
                        >
                          {copiedKey === copyKey ? "✓ Copied" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="dossier-actions">
          {!readonly && object.cleanupAction && onToggleSelect && (
            <button
              className={`dossier-act-btn ${isSelected ? "secondary" : "primary"}`}
              onClick={() => onToggleSelect(!isSelected)}
            >
              {isSelected ? (
                <>
                  <Check size={13} strokeWidth={2.5} /> IN CLEANUP QUEUE (CLICK TO REMOVE)
                </>
              ) : empty ? (
                <>
                  <Zap size={13} strokeWidth={2.2} /> RECLAIM REBATE (ADD TO CLEANUP)
                </>
              ) : isSuspicious ? (
                <>
                  <ShieldAlert size={13} strokeWidth={2.2} /> QUARANTINE & BURN OBJECT
                </>
              ) : (
                <>
                  <Plus size={13} strokeWidth={2.2} /> ADD TO CLEANUP ({object.cleanupAction.toUpperCase()})
                </>
              )}
            </button>
          )}

          <a
            className="dossier-act-btn outline"
            href={suiscanObjectUrl(network, object.objectId)}
            target="_blank"
            rel="noreferrer"
            data-act="open-suiscan"
          >
            OPEN IN SUISCAN
            <ExternalLink size={12} strokeWidth={2.2} />
          </a>
        </div>
      </div>
    </div>
  );
}
