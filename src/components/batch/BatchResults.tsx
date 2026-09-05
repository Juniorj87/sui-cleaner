/**
 * Batch results — one card per wallet: objects → cleanable → rebate → action.
 * Sort, filter, aggregate summary, CSV export. No analysis dashboard.
 */

import { useMemo, useState } from "react";
import type { BatchWalletResult } from "../../batch/batchScanner";
import {
  aggregateBatch,
  batchToCsv,
  downloadCsv,
  filterBatchResults,
  sortBatchResults,
  type BatchFilter,
  type BatchSortDir,
  type BatchSortKey,
} from "../../batch/batchResults";
import { shortDisplay } from "../../batch/addresses";
import type { EstimateSource } from "../../batch/rebateEstimate";

function sourceLabel(source: EstimateSource): string {
  switch (source) {
    case "simulation": return "Simulation";
    case "object": return "Object calculation";
    case "unavailable":
    default: return "Unavailable";
  }
}

/** executed-truth recap, e.g. "15 destroy_zero · 2 dust merge · 1 unsupported" */
function breakdownLine(r: { breakdown: { destroyZero: number; dustMerge: number; unsupported: number } }): string | null {
  const parts: string[] = [];
  if (r.breakdown.destroyZero > 0) parts.push(`${r.breakdown.destroyZero} destroy_zero`);
  if (r.breakdown.dustMerge > 0) parts.push(`${r.breakdown.dustMerge} dust merge`);
  if (r.breakdown.unsupported > 0) parts.push(`${r.breakdown.unsupported} unsupported`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const SORTS: Array<{ key: BatchSortKey; label: string }> = [
  { key: "wallet", label: "Wallet" },
  { key: "objects", label: "Objects" },
  { key: "cleanable", label: "Cleanable" },
  { key: "rebate", label: "Estimated Rebate" },
];

const FILTERS: Array<{ key: BatchFilter; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "cleanable", label: "HAS CLEANABLE" },
  { key: "none", label: "NO CLEANUP" },
  { key: "failed", label: "FAILED" },
];

export default function BatchResults({
  results,
  onViewWallet,
  onBack,
}: {
  results: BatchWalletResult[];
  onViewWallet: (address: string) => void;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<BatchSortKey>("rebate");
  const [sortDir, setSortDir] = useState<BatchSortDir>("desc");
  const [filter, setFilter] = useState<BatchFilter>("all");

  const agg = useMemo(() => aggregateBatch(results), [results]);
  const visible = useMemo(
    () => filterBatchResults(sortBatchResults(results, sortKey, sortDir), filter),
    [results, sortKey, sortDir, filter]
  );

  const clickSort = (key: BatchSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "wallet" ? "asc" : "desc");
    }
  };

  const exportCsv = () => {
    downloadCsv(`batch-results-${Date.now()}.csv`, batchToCsv(results));
  };

  return (
    <div className="batch-screen" data-batch="results">
      <div className="batch-head">
        <div>
          <h2 className="report-title">Batch results.</h2>
          <p className="final-sub">{agg.wallets} WALLETS SCANNED · Batch analysis only — cleanup stays individual.</p>
        </div>
        <div className="batch-head-actions">
          <button className="btn btn-secondary" data-act="export-csv" onClick={exportCsv}>
            EXPORT CSV
          </button>
          <button className="btn btn-secondary" data-act="back" onClick={onBack}>
            ← BACK
          </button>
        </div>
      </div>

      <div className="batch-summary" aria-live="polite">
        <span>{agg.wallets} WALLETS</span>
        <span>{agg.objects} OBJECTS</span>
        <span>{agg.safe} SAFE TO CLEAN</span>
        <span>{agg.review} REVIEW</span>
        <span>ESTIMATED STORAGE REBATE <b>+{agg.rebate.toFixed(4)} SUI</b></span>
        {agg.withEstimate < agg.wallets && (
          <span className="batch-summary-note">Estimate available for {agg.withEstimate} of {agg.wallets} wallets.</span>
        )}
      </div>

      <div className="batch-controls">
        <div className="batch-sort" role="group" aria-label="Sort by">
          <span className="batch-controls-label">SORT BY</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`batch-chip ${sortKey === s.key ? "active" : ""}`}
              data-act={`sort-${s.key}`}
              onClick={() => clickSort(s.key)}
            >
              {s.label}{sortKey === s.key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
            </button>
          ))}
        </div>
        <div className="batch-filter" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`batch-chip ${filter === f.key ? "active" : ""}`}
              data-act={`filter-${f.key}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="final-sub">No wallets match this filter.</p>
      )}

      <div className="batch-cards">
        {visible.map((r) => (
          <article key={r.address} className="batch-card" data-wallet={r.address}>
            <div className="batch-card-top">
              <div>
                <div className="batch-card-label">WALLET{r.label !== "—" ? ` · ${r.label}` : ""}</div>
                <div className="batch-card-addr mono" title={r.address}>{shortDisplay(r.address)}</div>
              </div>
              <span className={`batch-status ${r.status}`}>{r.status === "ready" ? "READY" : "FAILED"}</span>
            </div>
            {r.status === "ready" ? (
              <>
                <div className="batch-card-grid">
                  <div><span className="batch-card-label">OBJECTS</span><b>{r.objects}</b></div>
                  <div><span className="batch-card-label">SAFE TO CLEAN</span><b>{r.safe}</b></div>
                  <div><span className="batch-card-label">REVIEW</span><b>{r.review}</b></div>
                  <div><span className="batch-card-label">KEEP</span><b>{r.keep}</b></div>
                  <div className="batch-card-rebate">
                    <span className="batch-card-label">ESTIMATED STORAGE REBATE</span>
                    {r.source === "unavailable" ? (
                      <b className="batch-card-unavailable">Estimate unavailable</b>
                    ) : (
                      <b>+{r.rebate.toFixed(4)} SUI</b>
                    )}
                  </div>
                </div>
                <div className="batch-card-source">
                  <span className="batch-card-label">ESTIMATE SOURCE</span>
                  <span>
                    {sourceLabel(r.source)}
                    {r.source === "simulation" && breakdownLine(r) ? ` · ${breakdownLine(r)}` : ""}
                  </span>
                </div>
              </>
            ) : (
              <p className="final-sub">{r.error ?? "Scan failed."}</p>
            )}
            <button
              className="btn btn-primary"
              data-act="view-wallet"
              data-address={r.address}
              disabled={r.status !== "ready"}
              onClick={() => onViewWallet(r.address)}
            >
              VIEW WALLET
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
