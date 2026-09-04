import { suiscanTxUrl } from "../lib/suiscan";
import { getNetwork } from "../config";

/**
 * Success screen — shown ONLY for a real on-chain SUCCESS (or a chain
 * success with notes). The FAILED verdict lives on the failed screen.
 *
 * Chain success is the only gate: effects.status.status === "success".
 * All numbers here are ACTUAL on-chain values fetched after confirmation:
 *   - objects cleaned  = deleted objects counted from effects.deleted /
 *                        objectChanges (never from the pre-sign selection)
 *   - storage rebate   = effects.gasUsed.storageRebate
 *   - network gas      = effects.gasUsed.computation + storage (gross)
 *   - cleaner fee      = the fee actually received by the treasury
 *   - net result       = the sender's real SUI balance change on-chain
 * Nothing here is an estimate and nothing is hardcoded from the estimate.
 * When the executed (deleted) count is smaller than the pre-sign selection,
 * both counts are shown plus a neutral note — still SUCCESS, never FAILED.
 */
export default function SuccessScreen({
  before,
  after,
  removed,
  selectedCount,
  digest,
  status,
  discrepancies,
  gasUsedSui,
  storageRebateSui,
  grossGasSui,
  netResultSui,
  treasuryVerified,
  treasuryReceivedSui,
  onExplore,
  onScanAgain,
}: {
  before: number;
  after: number;
  /** ACTUAL on-chain deleted count (effects.deleted / objectChanges) — never the selection */
  removed: number;
  /** pre-sign selection size (informational; shown only when it exceeds `removed`) */
  selectedCount?: number;
  /** Real transaction digest — shown as a link to SuiScan */
  digest?: string;
  /** verification status — "success" or "state-differs" (confirmed on-chain, with notes) */
  status?: "success" | "state-differs" | "failure" | "verification-failed";
  /** human-readable notes when the chain succeeded with differences */
  discrepancies?: string[];
  /** actual net gas used (in SUI) from effects.gasUsed (kept for compat; not rendered as network gas) */
  gasUsedSui?: string;
  /** actual storage rebate (in SUI) from effects.gasUsed.storageRebate */
  storageRebateSui?: string;
  /** actual gross network gas (computation + storage, in SUI) */
  grossGasSui?: string;
  /** ACTUAL net result = the sender's on-chain SUI balance change, signed */
  netResultSui?: string;
  /** treasury verification: service fee went to correct address */
  treasuryVerified?: boolean;
  /** actual amount treasury received (in SUI) */
  treasuryReceivedSui?: string;
  onExplore: () => void;
  onScanAgain: () => void;
}) {
  void before;
  void after;
  void status;
  void gasUsedSui;
  const isRealTx =
    !!digest && !digest.startsWith("0x0000000000000000000000000000000000000000000000000000000000000000");
  const txUrl = isRealTx && digest ? suiscanTxUrl(getNetwork(), digest) : undefined;
  const hasNotes = !!discrepancies && discrepancies.length > 0;
  const chainConfirmed = isRealTx; // reaching this screen means confirmed on-chain

  // Partial execution: pre-sign selection vs. what the chain actually deleted.
  // Neutral informational note — NEVER a failure verdict.
  const selected =
    selectedCount != null && Number.isFinite(selectedCount) ? selectedCount : undefined;
  const partialCount =
    selected != null && selected > removed ? selected - removed : 0;
  const showSelectedRow = selected != null && selected > removed;

  return (
    <div className="success-screen-new" data-success={hasNotes ? "state-differs" : "ready"}>
      <div className="success-screen-new-content">
        <div className="success-screen-new-header">
          <h1 className="success-screen-new-title">
            {chainConfirmed ? "TRANSACTION CONFIRMED" : "WALLET CLEANED."}
          </h1>
          <p className="success-screen-new-subtitle">
            {chainConfirmed
              ? "Confirmed on-chain"
              : "Your wallet has been successfully cleaned (demo)."}
          </p>
        </div>

        {chainConfirmed && (
          <div className="success-screen-new-comparison">
            <div className="success-screen-new-comparison-header">
              <span className="success-screen-new-before">Confirmed</span>
              <span className="success-screen-new-sep" aria-hidden="true" />
              <span className="success-screen-new-after">On-chain</span>
            </div>
            <div className="success-screen-new-result">
              {showSelectedRow ? (
                <>
                  <span className="success-screen-new-selected">
                    Objects selected: {selected}
                  </span>
                  <span className="success-screen-new-removed">
                    Objects cleaned: {removed}
                  </span>
                </>
              ) : (
                <span className="success-screen-new-removed">
                  Objects cleaned: {removed}
                </span>
              )}
            </div>
            {partialCount > 0 && (
              <p className="success-screen-new-partial" data-testid="partial-note">
                {partialCount} selected object{partialCount === 1 ? " was" : "s were"} not
                included in the executed cleanup.
              </p>
            )}
          </div>
        )}

        {/* Demo fallback comparison (digest = 0x000…) */}
        {!chainConfirmed && (
          <div className="success-screen-new-comparison">
            <div className="success-screen-new-comparison-header">
              <span className="success-screen-new-before">Before</span>
              <span className="success-screen-new-sep" aria-hidden="true" />
              <span className="success-screen-new-after">After</span>
            </div>
            <div className="success-screen-new-result">
              <span className="success-screen-new-removed">{removed} removed</span>
            </div>
          </div>
        )}

        {/* Real transaction digest + explorer link (built from the real digest) */}
        {isRealTx && txUrl && digest && (
          <div className="success-tx-digest">
            <p className="success-tx-digest-label">Transaction Digest</p>
            <p className="success-tx-digest-hash" data-testid="tx-digest">
              {digest}
            </p>
            <a
              href={txUrl}
              target="_blank"
              rel="noreferrer"
              className="success-tx-link"
              data-act="view-transaction"
            >
              VIEW ON SUISCAN
            </a>
          </div>
        )}

        {/* ACTUAL post-confirmation result — on-chain values only, never estimates */}
        {isRealTx && (
          <div className="success-verify-card">
            <p className="success-verify-title">
              ACTUAL RESULT — ON-CHAIN VERIFIED
            </p>
            <div className="success-verify-rows">
              <div className="success-verify-row">
                <span className="success-verify-label">Transaction status</span>
                <span className="success-verify-value ok">Confirmed on-chain</span>
              </div>
              <div className="success-verify-row">
                <span className="success-verify-label">Storage rebate</span>
                <span className="success-verify-value ok">
                  {storageRebateSui != null && storageRebateSui !== ""
                    ? `+${storageRebateSui} SUI`
                    : "—"}
                </span>
              </div>
              <div className="success-verify-row">
                <span className="success-verify-label">Network gas</span>
                <span className="success-verify-value">
                  {grossGasSui != null && grossGasSui !== "" ? `-${grossGasSui} SUI` : "—"}
                </span>
              </div>
              <div className="success-verify-row">
                <span className="success-verify-label">SuiCleaner fee</span>
                <span className="success-verify-value">
                  {treasuryReceivedSui != null && treasuryReceivedSui !== ""
                    ? `-${treasuryReceivedSui} SUI`
                    : "—"}
                </span>
              </div>
              <div className="success-verify-row total">
                <span className="success-verify-label">Net result</span>
                <span className={`success-verify-value ${netResultSui?.startsWith("-") ? "bad" : "ok"}`}>
                  {netResultSui != null && netResultSui !== "" ? `${netResultSui} SUI` : "—"}
                </span>
              </div>
            </div>
            {treasuryVerified != null && (
              <p className="success-verify-treasury" data-testid="treasury-note">
                {treasuryVerified
                  ? "Treasury transfer verified."
                  : "Treasury transfer could not be verified — check the transaction on the explorer."}
              </p>
            )}
          </div>
        )}

        {/* Notes (chain succeeded — informational, never a failure verdict) */}
        {hasNotes && (
          <div className="success-discrepancies" data-kind="partial-note">
            <p className="success-discrepancies-title">
              VERIFICATION NOTES
            </p>
            <ul className="success-discrepancies-list">
              {discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
            <p className="success-discrepancies-note">
              Your transaction was confirmed on-chain. These notes describe differences between the
              plan and the executed result — check the transaction on the explorer.
            </p>
          </div>
        )}

        <div className="success-screen-new-reassurance">
          <p className="success-screen-new-reassurance-text">
            {hasNotes || partialCount > 0
              ? "The transaction executed on-chain. Re-scan your wallet to see the final state."
              : "Nothing else was touched."}
          </p>
        </div>

        <div className="success-screen-new-actions">
          <button
            className="btn btn-primary"
            data-act="explore"
            onClick={onExplore}
          >
            EXPLORE WALLET
          </button>
          <button
            className="btn btn-secondary"
            data-act="scan-again"
            onClick={onScanAgain}
          >
            SCAN ANOTHER WALLET
          </button>
        </div>
      </div>
    </div>
  );
}
