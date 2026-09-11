import { suiscanTxUrl } from "../../lib/suiscan";
import { getNetwork } from "../../config";
import { shortAddress } from "../../lib/suiAddress";
import type { CleanupRecord } from "../../cleanup/history";

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

/**
 * Cleanup History — local only (localStorage, no backend).
 * Shown only when at least one REAL recorded cleanup exists; never seeded.
 */
export default function CleanupHistory({ records }: { records: CleanupRecord[] }) {
  if (records.length === 0) return null;
  const network = getNetwork();
  return (
    <section className="history-card" aria-label="Cleanup History" data-testid="cleanup-history">
      <div className="history-title">CLEANUP HISTORY — LOCAL</div>
      {records.map((r) => {
        const isZeroDigest = /^0x0+$/.test(r.digest);
        return (
        <div className="history-row" key={`${r.digest}-${r.date}`}>
          <span title={new Date(r.date).toISOString()}>{formatDate(r.date)}</span>
          <span title={r.address}>{shortAddress(r.address)} · {r.objectsCleaned} object{r.objectsCleaned === 1 ? "" : "s"} cleaned{r.demo ? " (demo)" : ""}</span>
          {isZeroDigest ? (
            <span className="history-digest" title={r.digest}>demo · no on-chain tx</span>
          ) : (
          <a
            className="history-digest"
            href={suiscanTxUrl(network, r.digest)}
            target="_blank"
            rel="noreferrer"
            title={r.digest}
          >
            {r.digest.slice(0, 10)}…{r.digest.slice(-6)}
          </a>
          )}
          {r.storageRebateSui != null && r.storageRebateSui !== "" ? (
            <span className="history-amt" title="Actual on-chain storage rebate">+{r.storageRebateSui} SUI</span>
          ) : r.netResultSui != null && r.netResultSui !== "" ? (
            <span className="history-amt" title="Actual on-chain net result">{r.netResultSui} SUI</span>
          ) : null}
        </div>
        );
      })}
    </section>
  );
}
