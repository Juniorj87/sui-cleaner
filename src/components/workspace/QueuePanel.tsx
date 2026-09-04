import { useMemo, useState } from "react";
import type { WalletObject } from "../../scanner/objectClassifier";
import { coinInnerType, itemTypeLabel, storageRebateSui } from "../../lib/walletGroups";
import { extractCoinSymbol, fixIpfsUrl } from "../../lib/tokenMetadata";

interface QueuePanelProps {
  objects: WalletObject[];
  selection: Set<string>;
  onClear: () => void;
  onRemoveItem?: (id: string) => void;
  onRemoveGroup?: (ids: string[]) => void;
  onReviewCleanup: () => void;
  readonly?: boolean;
  fees: { networkFeeSui: string | null; cleanerFeeSui: string | null };
  flightTargetRef?: React.RefObject<HTMLDivElement | null>;
}

export default function QueuePanel({
  objects,
  selection,
  onClear,
  onRemoveItem,
  onRemoveGroup,
  onReviewCleanup,
  readonly,
  fees,
  flightTargetRef,
}: QueuePanelProps) {
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);

  // Selected object entities (the real rows this panel shows — never count ids
  // that are no longer in the object list)
  const selected = useMemo(
    () => objects.filter((o) => selection.has(o.objectId)),
    [objects, selection]
  );
  const count = selected.length;

  // Group items by name + cleanup action for compact presentation
  const groupedItems = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        symbol?: string;
        typeLabel: string;
        iconUrl?: string;
        ids: string[];
        count: number;
        totalRebate: number;
      }
    >();

    for (const o of selected) {
      const typeLabel = itemTypeLabel(o);
      // Honest per-object estimate: empty coin → destroy_zero rebate, dust coin
      // → merged container rebate. NFT / object burns return NO storage rebate.
      const rebate = storageRebateSui(o);
      const key = `${o.name || o.symbol || "obj"}::${typeLabel}`;

      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.ids.push(o.objectId);
        existing.totalRebate += rebate;
      } else {
        map.set(key, {
          name: o.name || o.symbol || "Object",
          symbol: o.symbol,
          typeLabel,
          iconUrl: o.iconUrl || o.imageUrl,
          ids: [o.objectId],
          count: 1,
          totalRebate: rebate,
        });
      }
    }

    return Array.from(map.values());
  }, [selected]);

  // Financial calculations — same semantics as the rest of the UI: only
  // deletions/consolidations that free storage produce a rebate.
  const totalRebateNum = useMemo(() => {
    return selected.reduce((acc, o) => acc + storageRebateSui(o), 0);
  }, [selected]);

  const rebateSui = totalRebateNum > 0 ? totalRebateNum.toFixed(4) : "0.0000";
  // Fee fallbacks mirror feeCalculator exactly — never a different literal.
  const gasSui = fees.networkFeeSui ?? "0.00142";
  const cleanerSui = fees.cleanerFeeSui ?? "0.015";

  // NET RESULT = storage rebate − network gas − cleaner fee — signed, never
  // clamped: a negative net result (rebate smaller than costs) is shown as
  // such instead of being silently displayed as 0 or as the raw rebate.
  const netNum = totalRebateNum - parseFloat(gasSui) - parseFloat(cleanerSui);
  const netSui = Math.abs(netNum).toFixed(4);
  const netResultDisplay = netNum >= 0 ? `+${netSui} SUI` : `-${netSui} SUI`;
  // burns (NFTs without a delete function) never return a rebate — say so
  const hasBurnedItems = selected.some((o) => o.cleanupAction === "burn");

  return (
    <aside className="cleanup-plan-panel" aria-label="Cleanup Plan" data-testid="cleanup-plan-panel">
      {/* 1. Header: Title & Selected Count Badge */}
      <div className="cp-header">
        <div className="cp-title-row">
          <h2 className="cp-title">CLEANUP PLAN</h2>
          <span className="cp-badge">{count}</span>
        </div>
        <div className="cp-subtitle">
          {count === 0
            ? "No objects selected"
            : `${count} object${count === 1 ? "" : "s"} selected`}
        </div>
      </div>

      {/* 2. Estimated Recovery Highlight */}
      <div ref={flightTargetRef as any} className="cp-recovery-hero">
        <span className="cp-recovery-lbl">Estimated recovery</span>
        <div className="cp-recovery-val" title={hasBurnedItems ? "Selected burns return no storage rebate — the number below only counts deletions/consolidations that free storage." : undefined}>
          {count === 0 ? "0.0000 SUI" : totalRebateNum > 0 ? `+${rebateSui} SUI` : "No rebate"}
        </div>
      </div>

      {/* 3. Cost & Receive Calculation Breakdown */}
      <div className="cp-breakdown">
        <div className="cp-breakdown-row">
          <span className="cp-row-label">Storage rebate</span>
          <span className="cp-row-val green">+{rebateSui} SUI</span>
        </div>

        <div className="cp-breakdown-row">
          <span className="cp-row-label">Network gas</span>
          <span className="cp-row-val dim">-{gasSui} SUI</span>
        </div>

        <div className="cp-breakdown-row">
          <span className="cp-row-label">Sui Cleaner fee</span>
          <span className="cp-row-val dim">-{cleanerSui} SUI</span>
        </div>

        <div className="cp-divider" />

        <div className="cp-breakdown-row you-receive-row">
          <span className="cp-receive-label">
            NET RESULT
            <button
              type="button"
              className="cp-info-trigger"
              onClick={() => setShowFeeTooltip(!showFeeTooltip)}
              onMouseEnter={() => setShowFeeTooltip(true)}
              onMouseLeave={() => setShowFeeTooltip(false)}
              aria-label="Net result information"
            >
              ⓘ
            </button>
            {showFeeTooltip && (
              <div className="cp-fee-tooltip" role="tooltip">
                Net result = storage rebate − network gas − Sui Cleaner protocol fee. Estimate until the transaction is confirmed.
              </div>
            )}
          </span>
          <span className={`cp-receive-val ${netNum < 0 ? "cp-receive-neg" : ""}`}>{netResultDisplay}</span>
        </div>
      </div>

      {/* 4. Selected Objects List */}
      <div className="cp-items-container">
        {count === 0 ? (
          <div className="cp-empty-state">
            <span className="cp-empty-icon">✓</span>
            <div className="cp-empty-title">No objects selected</div>
            <div className="cp-empty-sub">
              Select items from the table or use the Quick Clean action to populate your plan.
            </div>
          </div>
        ) : (
          <div className="cp-items-list">
            {groupedItems.map((item) => (
              <div key={`${item.name}-${item.typeLabel}`} className="cp-item-row">
                <div className="cp-item-avatar">
                  {item.iconUrl ? (
                    <img src={fixIpfsUrl(item.iconUrl) || ""} alt={item.name} className="cp-avatar-img" />
                  ) : (
                    <span className="cp-avatar-char">{item.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>

                <div className="cp-item-info">
                  <div className="cp-item-name" title={item.name}>
                    {item.name}
                  </div>
                  <div className="cp-item-type">{item.typeLabel}</div>
                </div>

                <div className="cp-item-val-group">
                  {item.count > 1 && <span className="cp-multiplier">x{item.count}</span>}
                  {item.totalRebate > 0 ? (
                    <span className="cp-item-val">+{item.totalRebate.toFixed(4)} SUI</span>
                  ) : (
                    <span
                      className="cp-item-val no-rebate"
                      title="Removed via transfer-to-0x0 — Sui returns no storage rebate for this object."
                    >
                      no rebate
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="cp-remove-btn"
                  onClick={() => {
                    if (onRemoveGroup && item.ids.length > 0) {
                      onRemoveGroup(item.ids);
                    } else if (onRemoveItem && item.ids[0]) {
                      onRemoveItem(item.ids[0]);
                    }
                  }}
                  title={`Remove ${item.name}`}
                  aria-label={`Remove ${item.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Safety Block: BEFORE YOU CLEAN */}
      <div className="cp-safety-block">
        <div className="cp-safety-title">BEFORE YOU CLEAN</div>
        <ul className="cp-safety-list">
          <li>
            <span className="safety-check">✓</span>
            <span>Your wallet stays under your control</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>We never access your private keys</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>Scan is read-only</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>Only selected objects are affected</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>Protected objects are excluded</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>You review the transaction before signing</span>
          </li>
          <li>
            <span className="safety-check">✓</span>
            <span>Network fee and Cleaner fee are shown</span>
          </li>
          <li className="safety-fee-item">
            <span className="safety-check">✓</span>
            <span>Cleaner fee: {cleanerSui} SUI ⓘ</span>
          </li>
        </ul>
      </div>

      {/* 6. Primary CTA */}
      <div className="cp-cta-block">
        <button
          type="button"
          className="cp-cta-btn"
          disabled={count === 0 || readonly}
          onClick={onReviewCleanup}
          title={count === 0 ? "Select objects to review cleanup" : "Proceed to review and clean"}
        >
          REVIEW & CLEAN <span aria-hidden="true">→</span>
        </button>
        <div className="cp-cta-sub">
          {count === 0
            ? "Select objects to review"
            : totalRebateNum > 0 && netNum > 0
              ? `Estimated net result ~${netSui} SUI`
              : totalRebateNum > 0
                ? `Storage rebate +${rebateSui} SUI — fees apply`
                : hasBurnedItems
                  ? "Burns return no storage rebate"
                  : "No storage rebate to reclaim"}
        </div>
      </div>

      {readonly && count > 0 && (
        <div className="cp-readonly-notice">
          Read-only mode. Connect the owner wallet to sign and execute this cleanup.
        </div>
      )}
    </aside>
  );
}
