import { useMemo, useState } from "react";
import { ShieldCheck, HelpCircle, Sparkles, Diamond, Layers, X, ArrowLeft } from "lucide-react";
import type { WalletObject } from "../scanner/objectClassifier";
import TokenCard from "./TokenCard";
import { coinInnerType, isEmptyCoinObject, type GroupStatus } from "../lib/walletGroups";

export interface CleanupFees {
  /** null in real mode until the transaction plan (dry-run) is ready */
  networkFeeSui: string | null;
  cleanerFeeSui: string | null;
  totalSui: string | null;
  /** storage rebate returned to the user (real mode dry-run) — may be "" */
  storageRebateSui?: string;
  /** individual gas breakdown from the dry-run (real mode) */
  computationCostSui?: string;
  storageCostSui?: string;
  /**
   * True net cost to the user = rawNetGas + cleanerFee.
   * Accounts for storage rebate offsetting gas costs.
   * Can be less than totalSui when rebate > 0.
   */
  netTotalSui?: string;
  /**
   * GROSS network gas (computation + storage, before the storage rebate
   * offsets it) — the honest "network gas" line of the financial result.
   */
  networkGasSui?: string;
  /**
   * NET RESULT = storage rebate − network gas − cleaner fee, signed
   * ("+0.00012" / "-0.01511"). The only figure that may be read as
   * "what the user ends up with" — and it is an ESTIMATE until the
   * transaction is confirmed.
   */
  netResultSui?: string;
}

interface CleanupGroup {
  id: string;
  title: string;
  status: GroupStatus;
  items: WalletObject[];
}

const MAX_ITEMS_VISIBLE = 8;

/**
 * CLEANUP — "What am I removing?" The selected artifacts gather in one
 * place, grouped so a large set (e.g. dozens of empty coin objects) stays
 * compact. The keep/remove split is obvious, and the fee is fully visible
 * before anything happens. Fees are never invented: in real mode the rows
 * stay at "Estimating…" until the simulated plan exists.
 */
export default function CleanupScreen({
  items,
  totalObjects,
  fees,
  demo,
  onRemove,
  onRemoveGroup,
  onReviewTransaction,
  onBack,
}: {
  items: WalletObject[];
  totalObjects: number;
  fees: CleanupFees;
  demo: boolean;
  onRemove: (id: string) => void;
  /** remove every object of one group from the cleanup (deselect group) */
  onRemoveGroup: (ids: string[]) => void;
  onReviewTransaction: () => void;
  onBack: () => void;
}) {
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const byKey = new Map<string, CleanupGroup>();
    for (const o of items) {
      const inner = coinInnerType(o.type);
      const key = isEmptyCoinObject(o)
        ? `empty:${inner ?? o.name}`
        : o.dust
          ? `dust:${inner ?? o.name}`
          : o.category === "nft"
            ? `nft:${o.collection.trim().toLowerCase()}`
            : `obj:${o.type}`;
      let g = byKey.get(key);
      if (!g) {
        const empty = key.startsWith("empty:");
        const dust = key.startsWith("dust:");
        g = {
          id: key,
          title: empty || dust ? o.name : o.category === "nft" && o.collection !== "—" ? o.collection : o.name,
          status: empty || dust ? "cleanable" : o.protected ? "protected" : o.classification === "keep" ? "keep" : "review",
          items: [],
        };
        byKey.set(key, g);
      }
      g.items.push(o);
    }
    return [...byKey.values()].sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const emptyGroups = useMemo(() => groups.filter((g) => g.id.startsWith("empty:")), [groups]);
  const dustGroups = useMemo(() => groups.filter((g) => g.id.startsWith("dust:")), [groups]);
  const recoverGroups = useMemo(() => groups.filter((g) => !g.id.startsWith("empty:") && !g.id.startsWith("dust:") && g.items.some((o) => o.cleanupAction === "withdraw")), [groups]);
  const otherGroups = useMemo(() => groups.filter((g) => !g.id.startsWith("empty:") && !g.id.startsWith("dust:") && !g.items.some((o) => o.cleanupAction === "withdraw")), [groups]);

  const emptyCount = emptyGroups.reduce((a, g) => a + g.items.length, 0);
  const dustCount = dustGroups.reduce((a, g) => a + g.items.length, 0);
  const recoverCount = recoverGroups.reduce((a, g) => a + g.items.length, 0);
  const otherCount = otherGroups.reduce((a, g) => a + g.items.length, 0);
  const nft = items.filter((o) => o.category === "nft").length;
  const token = items.filter((o) => o.category === "coin").length;
  const remove = items.length;
  const keep = totalObjects - remove;
  const hasTransferWarning = items.some(
    (o) => (o.category === "nft" || o.category === "object") && o.cleanupAction === "burn"
  );
  const toggleAll = (id: string) =>
    setShowAll((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const kindParts: string[] = [];
  if (emptyCount > 0) kindParts.push(`${emptyCount} empty coin object${emptyCount === 1 ? "" : "s"}`);
  if (dustCount > 0) kindParts.push(`${dustCount} dust coin${dustCount === 1 ? "" : "s"}`);
  if (recoverCount > 0) kindParts.push(`${recoverCount} recoverable`);
  if (nft > 0) kindParts.push(`${nft} NFT${nft === 1 ? "" : "s"}`);
  const otherTokenCount = token - emptyCount - dustCount;
  if (otherTokenCount > 0) kindParts.push(`${otherTokenCount} token${otherTokenCount === 1 ? "" : "s"}`);
  const kindNote = kindParts.join(" · ");
  const dustNote =
    dustCount > 0
      ? `${dustCount} dust coin${dustCount === 1 ? "" : "s"} · merged (balance kept)`
      : undefined;

  // real mode: never show an invented number — wait for the simulated plan
  const feesReady = !demo && fees.networkFeeSui != null && fees.totalSui != null;

  const renderGroup = (g: CleanupGroup) => {
    const show = showAll.has(g.id);
    const shown = show ? g.items : g.items.slice(0, MAX_ITEMS_VISIBLE);
    const isEmptyGroup = g.id.startsWith("empty:");
    return (
      <div
        className={`cleanup-group ${isEmptyGroup ? "is-empty" : ""}`}
        key={g.id}
        data-cleanup-group={g.id}
      >
        <div className="cleanup-group-head">
          <span className="cleanup-group-icon" style={{ display: "inline-flex", alignItems: "center" }}>
            {g.status === "protected" ? <ShieldCheck size={16} /> : g.status === "review" ? <HelpCircle size={16} /> : g.id.startsWith("empty:") || g.id.startsWith("dust:") ? <Sparkles size={16} /> : g.id.startsWith("nft:") ? <Diamond size={16} /> : <Layers size={16} />}
          </span>
          <span className="cleanup-group-title">{g.title}</span>
          <span className="cleanup-group-count">
            {g.id.startsWith("empty:")
              ? `${g.items.length} empty object${g.items.length === 1 ? "" : "s"} · 0 balance · REMOVE`
              : g.id.startsWith("dust:")
                ? `${g.items.length} object${g.items.length === 1 ? "" : "s"} · small balance · CONVERT TO SUI`
                : g.items.some((o) => o.cleanupAction === "withdraw")
                  ? `${g.items.length} object${g.items.length === 1 ? "" : "s"} · RECOVER`
                  : `${g.items.length} object${g.items.length === 1 ? "" : "s"} · REMOVE`}
          </span>
          {g.items.length > 1 && (
            <button
              className="cleanup-group-remove"
              data-remove-group={g.id}
              onClick={() => onRemoveGroup(g.items.map((o) => o.objectId))}
              title={`Remove the whole ${g.title} group from the cleanup`}
            >
              Remove group
            </button>
          )}
        </div>
        <div className="cleanup-group-items" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "24px 26px" }}>
          {shown.map((o) => (
            <div key={o.objectId} style={{ position: "relative" }}>
              <TokenCard
                object={o}
                compact={true}
                style={{
                  background: "rgba(14, 14, 18, 0.6)",
                  border: "1px solid rgba(242, 237, 228, 0.06)",
                  borderRadius: "12px",
                }}
              />
              <button
                className="cleanup-remove-btn"
                data-remove-id={o.objectId}
                onClick={() => onRemove(o.objectId)}
                aria-label={`Remove ${o.name} from cleanup`}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {g.items.length > MAX_ITEMS_VISIBLE && (
            <button className="cleanup-more" onClick={() => toggleAll(g.id)}>
              {show ? "Show fewer" : `Show all ${g.items.length} objects`}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="cleanup" data-cleanup="ready">
      <p className="report-eyebrow">Your cleanup</p>
      <h2 className="report-title">
        Your cleanup is <span className="highlight">ready.</span>
      </h2>

      <div className="cleanup-hero">
        <span className="cleanup-num">{remove}</span>
        <div className="cleanup-hero-meta">
          <span className="cleanup-label">items</span>
          <span className="cleanup-kinds">{kindNote}</span>
          {dustNote && <span className="cleanup-kinds dust-note">{dustNote}</span>}
        </div>
      </div>

      {/* plain-language notes — empty coin objects and dust merging */}
      {emptyCount > 0 && (
        <div className="cleanup-tip" role="note" data-tip="empty-coins">
          <strong>Empty coin objects:</strong> this is an empty on-chain coin object. The token's
          balance was spent, but the empty object still exists in your wallet and occupies storage.
          It contains no token balance — removing it does not destroy token value, and it returns
          you the storage rebate.
        </div>
      )}
      {dustCount > 0 && (
        <div className="cleanup-tip dust-tip" role="note">
          <strong>Dust coins:</strong> tiny balances are merged into one coin of the same type —
          the amount stays in your wallet, and only the emptied objects are destroyed (storage
          rebate returned). A balance is never burned.
        </div>
      )}

      {/* explicit warnings for the removal mechanisms that do NOT return the storage rebate */}
      {hasTransferWarning && (
        <div className="cleanup-warning" role="note">
          <strong>Please note:</strong> some of these objects will be transferred to the 0x0
          address. They disappear from your wallet, but you will not get the storage rebate back —
          these contracts have no full-deletion function.
        </div>
      )}

      {/* the list — grouped by action type, compact; empty objects first, dimmed */}
      <div className="cleanup-list">
        {/* EMPTY OBJECTS section */}
        {emptyGroups.length > 0 && (
          <div className="cleanup-section-header">
            <span className="cleanup-section-title">EMPTY OBJECTS</span>
            <span className="cleanup-section-count">{emptyCount}</span>
          </div>
        )}
        {emptyGroups.map((g) => renderGroup(g))}

        {/* DUST section */}
        {dustGroups.length > 0 && (
          <div className="cleanup-section-header">
            <span className="cleanup-section-title">DUST</span>
            <span className="cleanup-section-count">{dustCount}</span>
          </div>
        )}
        {dustGroups.map((g) => renderGroup(g))}

        {/* RECOVER section */}
        {recoverGroups.length > 0 && (
          <div className="cleanup-section-header">
            <span className="cleanup-section-title">RECOVER</span>
            <span className="cleanup-section-count">{recoverCount}</span>
          </div>
        )}
        {recoverGroups.map((g) => renderGroup(g))}

        {/* OTHER CLEANUP section */}
        {otherGroups.length > 0 && (
          <div className="cleanup-section-header">
            <span className="cleanup-section-title">OTHER CLEANUP</span>
            <span className="cleanup-section-count">{otherCount}</span>
          </div>
        )}
        {otherGroups.map((g) => renderGroup(g))}

        {items.length === 0 && <p className="cleanup-empty">Nothing selected for cleanup.</p>}
      </div>

      {/* keep / remove summary */}
      <div className="keep-remove">
        <div className="keep-remove-block">
          <span className="keep-remove-label">You keep</span>
          <span className="keep-remove-num">{keep}</span>
          <span className="keep-remove-unit">items</span>
        </div>
        <div className="keep-remove-block accent">
          <span className="keep-remove-label">You remove</span>
          <span className="keep-remove-num">{remove}</span>
          <span className="keep-remove-unit">items</span>
        </div>
        <div className="keep-remove-block total">
          <span className="keep-remove-label">Total</span>
          <span className="keep-remove-num">{totalObjects}</span>
          <span className="keep-remove-unit">items</span>
        </div>
      </div>

      <p className="trust-note">Nothing else will be touched.</p>

      {/* CLEANUP ESTIMATE — one panel, one formula:
          NET RESULT = storage rebate − network gas − SuiCleaner fee.
          Everything here is an ESTIMATE until the transaction is confirmed;
          "You receive" is deliberately never shown pre-execution. */}
      <div className="cleanup-estimate" data-estimate={demo || feesReady ? "ready" : "estimating"}>
        <p className="cleanup-estimate-title">CLEANUP ESTIMATE</p>
        {demo || feesReady ? (
          <>
            {fees.storageRebateSui != null && fees.storageRebateSui !== "" && fees.storageRebateSui !== "0" && (
              <div className="tx-row roi-row">
                <span className="label">Storage rebate</span>
                <span className="value roi-plus">+{fees.storageRebateSui} SUI</span>
              </div>
            )}
            <div className="tx-row roi-row">
              <span className="label">Network gas</span>
              <span className="value roi-minus">−{fees.networkGasSui ?? fees.networkFeeSui ?? "—"} SUI</span>
            </div>
            <div className="tx-row roi-row">
              <span className="label">SuiCleaner fee (flat)</span>
              <span className="value roi-minus">−{fees.cleanerFeeSui ?? "—"} SUI</span>
            </div>
            <div className="tx-row roi-row total">
              <span className="label">Estimated net result</span>
              <span className={`value ${fees.netResultSui?.startsWith("-") ? "roi-minus" : "roi-plus"}`}>
                {fees.netResultSui ?? "—"} SUI
              </span>
            </div>
          </>
        ) : (
          <div className="tx-row estimating">
            <span className="label">Estimating network cost…</span>
            <span className="value muted">Estimating…</span>
          </div>
        )}
        <p className="cleanup-estimate-note">
          This is an estimate. The final amount depends on the actual transaction effects.
        </p>
      </div>

      <div className="cleanup-actions">
        <button className="btn btn-secondary" data-act="back" onClick={onBack}>
          <ArrowLeft size={14} /> BACK TO WORKSPACE
        </button>
        <button
          className="btn btn-primary"
          data-act="to-final"
          onClick={onReviewTransaction}
          disabled={remove === 0}
        >
          REVIEW TRANSACTION
        </button>
      </div>
    </div>
  );
}
