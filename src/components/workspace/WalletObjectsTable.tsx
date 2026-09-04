import { useState, useMemo } from "react";
import { Search, X, Inbox, Check, MoreVertical, ChevronLeft, ChevronRight, Wallet, Sparkles, Lock } from "lucide-react";
import type { WalletObject } from "../../scanner/objectClassifier";
import { coinInnerType } from "../../lib/walletGroups";
import { extractCoinSymbol, fixIpfsUrl } from "../../lib/tokenMetadata";

/** object list filter — every category the product logic actually supports */
export type ObjectFilter =
  | "all"
  | "cleanable"
  | "tokens"
  | "nfts"
  | "defi"
  | "dust"
  | "review"
  | "protected";

interface WalletObjectsTableProps {
  objects: WalletObject[];
  selection: Set<string>;
  onSelectObject: (id: string, select: boolean, el?: HTMLElement) => void;
  onSelectGroup: (ids: string[], select: boolean, el?: HTMLElement) => void;
  onClearSelection: () => void;
  onInspect: (obj: WalletObject) => void;
  readonly?: boolean;
  onReviewCleanup?: () => void;
  onConnect?: () => void;
  activeFilter?: ObjectFilter;
  onFilterChange?: (filter: ObjectFilter) => void;
  address?: string;
}

function shortId(id: string): string {
  if (!id) return "";
  if (id.length <= 16) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/**
 * An object may be added to the cleanup selection. Selection mirrors the
 * cleanup plan: verified action + never protected + classification cleanable
 * (review/suspicious objects must be inspected first, via the dossier — they
 * are never bulk-checked). This INCLUDES verified-cleanable NFTs: the
 * classifier only grants NFTs a burn action when a removal mechanism exists
 * (store-able → transfer-to-0x0), so those junk NFTs are safe to queue.
 */
function isSelectable(o: WalletObject): boolean {
  if (o.protected || o.classification === "protected") return false;
  if (o.classification !== "cleanable") return false;
  return !!o.cleanupAction;
}

/** per-object estimated storage rebate (SUI) — mirrors the cleanup plan math */
function objectRebate(o: WalletObject): number {
  if (o.coinBalance === "0") return 0.0028;
  if (o.dust) return 0.002;
  // NFT / object "burn" (transfer to 0x0) returns NO storage rebate; withdraw
  // recovers value, not a rebate — never invent a number for either.
  return 0;
}

// Token color themes for known tokens
function tokenColorTheme(name?: string): { bg: string; border: string; text: string } {
  const n = (name ?? "").toUpperCase();
  if (n === "SUI") return { bg: "rgba(56,189,248,0.18)", border: "rgba(56,189,248,0.4)", text: "#38bdf8" };
  if (n === "USDC") return { bg: "rgba(39,117,202,0.2)", border: "rgba(39,117,202,0.4)", text: "#60a5fa" };
  if (n === "USDT") return { bg: "rgba(38,161,123,0.2)", border: "rgba(38,161,123,0.4)", text: "#34d399" };
  if (n === "WETH") return { bg: "rgba(167,139,250,0.2)", border: "rgba(167,139,250,0.4)", text: "#c084fc" };
  if (n === "CETUS") return { bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.4)", text: "#f87171" };
  if (n === "BLUB") return { bg: "rgba(234,179,8,0.18)", border: "rgba(234,179,8,0.4)", text: "#facc15" };
  return { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.25)", text: "#94a3b8" };
}

function RowAvatar({ obj }: { obj: WalletObject }) {
  const [failed, setFailed] = useState(false);
  const isZero = obj.coinBalance === "0";
  const inner = coinInnerType(obj.type) ?? obj.type;
  const symbol = obj.symbol || extractCoinSymbol(inner);
  const display = symbol || obj.name || "OBJ";
  const theme = tokenColorTheme(display);
  const icon = fixIpfsUrl(obj.iconUrl || obj.imageUrl);

  if (icon && !failed) {
    return (
      <div className="tbl-avatar-wrap">
        <img
          src={icon}
          alt={display}
          className="tbl-avatar-img"
          onError={() => setFailed(true)}
          loading="lazy"
        />
        {isZero && <span className="tbl-avatar-zero">0</span>}
      </div>
    );
  }

  return (
    <div
      className="tbl-avatar"
      style={{
        background: isZero ? "rgba(251, 191, 36, 0.15)" : theme.bg,
        borderColor: isZero ? "rgba(251, 191, 36, 0.4)" : theme.border,
        color: isZero ? "#fbbf24" : theme.text,
      }}
    >
      <span>{display.slice(0, 2).toUpperCase()}</span>
      {isZero && <span className="tbl-avatar-zero">0</span>}
    </div>
  );
}

/**
 * NFT statuses mirror the rest of the inventory: an NFT is only CLEANABLE
 * when a verified removal mechanism exists (store-able → transfer-to-0x0),
 * KEEP when it is a verified/valuable asset, REVIEW when it needs inspection
 * (unknown or flagged), PROTECTED when the system protects it. A junk NFT
 * that is safe to remove is selectable — everything else is inspect-only.
 */
function nftStatus(o: WalletObject): "Keep" | "Review" | "Cleanable" | "Protected" {
  if (o.protected || o.classification === "protected") return "Protected";
  if (o.classification === "keep") return "Keep";
  if (o.classification === "cleanable" && o.cleanupAction) return "Cleanable";
  return "Review";
}

function statusMeta(o: WalletObject): { label: string; cls: string } {
  if (o.protected || o.classification === "protected") return { label: "Protected", cls: "badge-protected" };
  if (o.category === "nft") {
    const s = nftStatus(o);
    if (s === "Keep") return { label: "Keep", cls: "badge-keep" };
    if (s === "Cleanable") return { label: "Cleanable", cls: "badge-cleanable" };
    if (s === "Review") return { label: "Review", cls: "badge-review" };
    return { label: "Protected", cls: "badge-protected" };
  }
  if (o.classification === "review" || o.classification === "suspicious")
    return { label: "Review", cls: "badge-review" };
  if (isSelectable(o)) {
    if (o.dust) return { label: "Dust", cls: "badge-dust" };
    return { label: "Cleanable", cls: "badge-cleanable" };
  }
  if (o.coinBalance === "0") return { label: "Cleanable", cls: "badge-cleanable" };
  return { label: "Keep", cls: "badge-keep" };
}

export default function WalletObjectsTable({
  objects,
  selection,
  onSelectObject,
  onSelectGroup,
  onClearSelection,
  onInspect,
  readonly,
  onReviewCleanup,
  onConnect,
  activeFilter = "all",
  onFilterChange,
  address,
}: WalletObjectsTableProps) {
  const [filter, setFilter] = useState<ObjectFilter>(activeFilter);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 40;

  const currentFilter = onFilterChange ? activeFilter : filter;
  const handleFilterSelect = (tab: ObjectFilter) => {
    if (onFilterChange) onFilterChange(tab);
    else setFilter(tab);
    setPage(1);
  };

  // Per-category counts — every tab the product logic supports
  const counts = useMemo(() => {
    const total = objects.length;
    const cleanable = objects.filter((o) => isSelectable(o)).length;
    const tokens = objects.filter((o) => o.category === "coin" && !o.dust && o.coinBalance !== "0").length;
    const nfts = objects.filter((o) => o.category === "nft").length;
    const defi = objects.filter((o) => !!o.position).length;
    const dust = objects.filter((o) => !!o.dust && !o.protected).length;
    const review = objects.filter((o) => o.classification === "review" || o.classification === "suspicious").length;
    const protectedCount = objects.filter((o) => o.protected).length;
    return { total, cleanable, tokens, nfts, defi, dust, review, protectedCount };
  }, [objects]);

  // Segmented tabs — status tabs always shown, category tabs only when present
  const tabs: Array<{ key: ObjectFilter; label: string; count: number; cls?: string }> = [
    { key: "all" as const, label: "All", count: counts.total },
    { key: "cleanable" as const, label: "Cleanable", count: counts.cleanable, cls: "cleanable" },
    { key: "tokens" as const, label: "Tokens", count: counts.tokens, cls: "tokens" },
    { key: "nfts" as const, label: "NFTs", count: counts.nfts, cls: "nfts" },
    { key: "defi" as const, label: "DeFi", count: counts.defi, cls: "defi" },
    { key: "dust" as const, label: "Dust / Zero", count: counts.dust, cls: "dust" },
    { key: "review" as const, label: "Review", count: counts.review, cls: "review" },
    { key: "protected" as const, label: "Protected", count: counts.protectedCount, cls: "protected" },
  ].filter((t) => t.key === "all" || t.key === "cleanable" || t.key === "review" || t.key === "protected" || t.count > 0);

  // Filtered list
  const filteredList = useMemo(() => {
    let list = objects;
    if (currentFilter === "cleanable") list = list.filter((o) => isSelectable(o));
    else if (currentFilter === "tokens") list = list.filter((o) => o.category === "coin" && !o.dust && o.coinBalance !== "0");
    else if (currentFilter === "nfts") list = list.filter((o) => o.category === "nft");
    else if (currentFilter === "defi") list = list.filter((o) => !!o.position);
    else if (currentFilter === "dust") list = list.filter((o) => !!o.dust && !o.protected);
    else if (currentFilter === "review") list = list.filter((o) => o.classification === "review" || o.classification === "suspicious");
    else if (currentFilter === "protected") list = list.filter((o) => o.protected);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((o) => {
        const name = (o.name || "").toLowerCase();
        const symbol = (o.symbol || "").toLowerCase();
        const objId = (o.objectId || "").toLowerCase();
        const type = (o.type || "").toLowerCase();
        const collection = (o.collection || "").toLowerCase();
        return name.includes(q) || symbol.includes(q) || objId.includes(q) || type.includes(q) || collection.includes(q);
      });
    }
    return list;
  }, [objects, currentFilter, search]);

  // Every object eligible for cleanup right now (across all tabs) — the set
  // SELECT ALL acts on. Protected / review / keep objects are never included.
  const cleanableIds = useMemo(
    () => objects.filter((o) => isSelectable(o)).map((o) => o.objectId),
    [objects]
  );
  const allCleanableSelected =
    cleanableIds.length > 0 && cleanableIds.every((id) => selection.has(id));

  // Selection summary — rebate math mirrors the cleanup plan
  const selectedStats = useMemo(() => {
    const selectedObjects = objects.filter((o) => selection.has(o.objectId));
    const actionable = selectedObjects.filter((o) => isSelectable(o));
    const rebate = actionable.reduce((acc, o) => acc + objectRebate(o), 0);
    return { count: actionable.length, rebateSui: rebate.toFixed(4), hasRebate: rebate > 0 };
  }, [objects, selection]);

  const canClean = selectedStats.count > 0 && !readonly;

  // Toggle: when every eligible object is already selected the button becomes
  // CLEAR SELECTION — one control, two honest states.
  const toggleSelectAllCleanable = () => {
    if (cleanableIds.length === 0) return;
    if (allCleanableSelected) onSelectGroup(cleanableIds, false);
    else onSelectGroup(cleanableIds, true);
  };

  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  return (
    <section className="wallet-objects-card" aria-label="Wallet objects">
      {/* Header: title + bulk actions */}
      <div className="tbl-header-top">
        <div className="tbl-title-group">
          <h2 className="tbl-section-title">WALLET OBJECTS</h2>
          {selectedStats.count > 0 && (
            <span className="tbl-selected-chip" data-testid="selected-count">
              {selectedStats.count} selected
            </span>
          )}
        </div>

        <div className="tbl-bulk-actions">
          <button
            type="button"
            className={`tbl-bulk-btn ${allCleanableSelected ? "ghost" : ""}`}
            onClick={toggleSelectAllCleanable}
            disabled={counts.cleanable === 0 || readonly}
            title={
              allCleanableSelected
                ? "Clear the selection of all cleanable objects"
                : "Select every object that is eligible for cleanup (protected and review objects are never auto-selected)"
            }
          >
            {allCleanableSelected ? <X size={12} strokeWidth={2.4} /> : <Check size={12} strokeWidth={2.4} />}
            <span>{allCleanableSelected ? "CLEAR SELECTION" : "SELECT ALL CLEANABLE"}</span>
          </button>
          {selection.size > 0 && !allCleanableSelected && (
            <button type="button" className="tbl-bulk-btn ghost" onClick={onClearSelection} title="Clear selection">
              <X size={12} strokeWidth={2.4} />
              <span>CLEAR</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: filter tabs + search */}
      <div className="tbl-toolbar-row">
        <div className="tbl-filter-tabs" role="tablist" aria-label="Filter objects">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={currentFilter === t.key}
              className={`tbl-tab-pill ${currentFilter === t.key ? "active" : ""}`}
              onClick={() => handleFilterSelect(t.key)}
            >
              <span>{t.label}</span>
              <span className={`pill-badge ${t.cls ?? ""}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="tbl-search-controls">
          <div className="tbl-search-box">
            <Search size={15} strokeWidth={2} className="tbl-search-icon" />
            <input
              type="text"
              className="tbl-search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, type or address..."
              aria-label="Search wallet objects"
            />
            {search && (
              <button
                type="button"
                className="tbl-search-clear"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                aria-label="Clear search"
              >
                <X size={13} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NFT status legend — why a row can or cannot be selected */}
      {currentFilter === "nfts" && (
        <div className="tbl-nft-legend" data-testid="nft-legend">
          <span className="nft-legend-item nft-keep">
            <span className="nft-legend-dot" />
            <b>Keep</b> — real asset, stays untouched
          </span>
          <span className="nft-legend-item nft-cleanable">
            <span className="nft-legend-dot" />
            <b>Cleanable</b> — safe to remove (burn, no storage rebate)
          </span>
          <span className="nft-legend-item nft-review">
            <span className="nft-legend-dot" />
            <b>Review</b> — requires review before any action
          </span>
          <span className="nft-legend-item nft-protected">
            <span className="nft-legend-dot" />
            <b>Protected</b> — cannot be removed automatically
          </span>
        </div>
      )}

      {/* Selection summary bar */}
      {selectedStats.count > 0 && (
        <div className="tbl-selection-bar" data-testid="selection-bar">
          <div className="sel-bar-left">
            <span className="sel-bar-count">
              <strong>{selectedStats.count}</strong> object{selectedStats.count === 1 ? "" : "s"} selected
            </span>
            {selectedStats.hasRebate ? (
              <span className="sel-bar-rebate">
                Estimated storage rebate <b className="sel-rebate-val">+{selectedStats.rebateSui} SUI</b>
              </span>
            ) : (
              <span className="sel-bar-rebate muted">No storage rebate — burn cleanup only</span>
            )}
          </div>
          <div className="sel-bar-actions">
            {readonly ? (
              <button type="button" className="sel-bar-connect" onClick={onConnect}>
                <Wallet size={13} strokeWidth={2.2} />
                <span>CONNECT WALLET</span>
              </button>
            ) : (
              <button
                type="button"
                className="sel-bar-clean"
                data-act="review-cleanup"
                onClick={() => onReviewCleanup?.()}
                disabled={!canClean}
                title="Review the selected objects before signing"
              >
                <Sparkles size={13} strokeWidth={2.2} />
                <span>REVIEW &amp; CLEAN</span>
              </button>
            )}
            <button type="button" className="sel-bar-clear" onClick={onClearSelection}>
              CLEAR SELECTION
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="tbl-container">
        <table className="compact-table">
          <thead>
            <tr>
              <th className="col-select" aria-label="Select" />
              <th className="col-object">OBJECT</th>
              <th className="col-type">TYPE</th>
              <th className="col-balance">BALANCE</th>
              <th className="col-status">STATUS</th>
              <th className="col-reclaimable">RECLAIMABLE</th>
              <th className="col-action">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={7} className="tbl-empty-row">
                  <div className="tbl-empty-content">
                    <div className="tbl-empty-icon-wrap" aria-hidden="true">
                      <Inbox size={26} strokeWidth={1.8} />
                    </div>
                    <div className="tbl-empty-title">No wallet objects found</div>
                    <div className="tbl-empty-sub">
                      {search
                        ? "No objects match your search criteria. Try a different query or clear filters."
                        : "Connect a wallet or scan a Sui address to inspect its on-chain objects."}
                    </div>
                    <div className="tbl-empty-actions">
                      {search ? (
                        <button
                          type="button"
                          className="tbl-empty-btn"
                          onClick={() => {
                            setSearch("");
                            setPage(1);
                          }}
                        >
                          Clear search
                        </button>
                      ) : onConnect ? (
                        <button type="button" className="tbl-empty-btn primary" onClick={onConnect}>
                          <Wallet size={13} strokeWidth={2.2} />
                            <span>{address && !readonly ? "CLEAN MY WALLET" : "CONNECT WALLET"}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedList.map((o) => {
                const isSelected = selection.has(o.objectId);
                const selectable = isSelectable(o);
                const isZero = o.coinBalance === "0";
                const isDust = !!o.dust;
                const sm = statusMeta(o);

                let typeLabel = "Object";
                if (isDust) typeLabel = "Dust Token";
                else if (o.category === "coin") typeLabel = isZero ? "Object" : "Token";
                else if (o.category === "nft") typeLabel = "NFT";
                else if (o.position) typeLabel = "DeFi";

                const inner = coinInnerType(o.type) ?? o.type;
                const symbol = o.symbol || extractCoinSymbol(inner);
                let balanceStr = "—";
                if (isZero) balanceStr = `0 ${symbol || "SUI"}`;
                else if (o.formattedBalance) balanceStr = `${o.formattedBalance} ${symbol || ""}`;
                else if (o.coinBalance != null) balanceStr = `${o.coinBalance} ${symbol || ""}`;
                else if (o.value != null && o.value > 0) balanceStr = `$${o.value.toFixed(2)}`;

                let reclaimableStr = "—";
                let reclaimableNoRebate = false;
                if (isSelectable(o)) {
                  const rb = objectRebate(o);
                  if (rb > 0) {
                    reclaimableStr = `+${rb.toFixed(4)} SUI`;
                  } else if (o.cleanupAction === "burn") {
                    // NFT / object burn (transfer to 0x0) frees no storage —
                    // never invent a rebate number for it.
                    reclaimableStr = "No rebate";
                    reclaimableNoRebate = true;
                  }
                } else if (isZero && !o.protected) {
                  reclaimableStr = `+${objectRebate(o).toFixed(4)} SUI`;
                }

                const rowAction = isSelected ? "In Queue" : "Inspect";

                return (
                  <tr
                    key={o.objectId}
                    className={`compact-table-row ${isSelected ? "row-selected" : ""}`}
                    onClick={() => onInspect(o)}
                    title="Click row to inspect details"
                  >
                    {/* Selection checkbox */}
                    <td className="col-select" onClick={(e) => e.stopPropagation()}>
                      {selectable ? (
                        <input
                          type="checkbox"
                          className="tbl-row-check"
                          checked={isSelected}
                          onChange={(e) => onSelectObject(o.objectId, e.target.checked, e.currentTarget)}
                          aria-label={`Select ${o.name || symbol || o.objectId}`}
                          title={isSelected ? "Remove from cleanup" : "Add to cleanup"}
                        />
                      ) : o.protected ? (
                        <Lock
                          size={13}
                          strokeWidth={2}
                          className="tbl-lock-icon"
                          aria-label="Protected object — never eligible for cleanup"
                        />
                      ) : (
                        <span
                          className="tbl-row-check disabled"
                          aria-hidden="true"
                          title="Not eligible for automatic cleanup — inspect to review"
                        />
                      )}
                    </td>

                    {/* OBJECT */}
                    <td className="col-object">
                      <div className="obj-cell">
                        <RowAvatar obj={o} />
                        <div className="obj-info">
                          <div className="obj-name" title={o.name}>
                            {o.name || symbol || "Unnamed Object"}
                          </div>
                          <div className="obj-id-mono" title={o.objectId}>
                            {shortId(o.objectId)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* TYPE */}
                    <td className="col-type">
                      <span className="type-label">{typeLabel}</span>
                    </td>

                    {/* BALANCE */}
                    <td className="col-balance">
                      <span className="balance-text">{balanceStr}</span>
                    </td>

                    {/* STATUS */}
                    <td className="col-status">
                      <span className={`status-badge ${sm.cls}`}>{sm.label}</span>
                    </td>

                    {/* RECLAIMABLE */}
                    <td className="col-reclaimable">
                      <span
                        className={`reclaimable-text ${reclaimableStr !== "—" ? "has-rebate" : ""} ${reclaimableNoRebate ? "no-rebate" : ""}`}
                        title={
                          reclaimableNoRebate
                            ? "This object is removed via transfer-to-0x0 (burn) — Sui returns no storage rebate for it."
                            : undefined
                        }
                      >
                        {reclaimableStr}
                      </span>
                    </td>

                    {/* ACTION */}
                    <td className="col-action" onClick={(e) => e.stopPropagation()}>
                      <div className="action-cell">
                        <button
                          type="button"
                          className="row-action-btn btn-inspect"
                          onClick={() => onInspect(o)}
                          title={rowAction === "Inspect" ? "Inspect object details" : "Inspect before adding"}
                        >
                          {rowAction === "In Queue" ? (
                            <>
                              <Check size={12} strokeWidth={2.5} />
                              <span>{rowAction}</span>
                            </>
                          ) : (
                            rowAction
                          )}
                        </button>
                        <button
                          type="button"
                          className="row-more-btn"
                          onClick={() => onInspect(o)}
                          title="Inspect details"
                          aria-label="Inspect details"
                        >
                          <MoreVertical size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="tbl-pagination">
          <span className="pagination-info">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filteredList.length)} of {filteredList.length} objects
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
            <span className="pagination-page">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
