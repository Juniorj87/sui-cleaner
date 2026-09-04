import { useState } from "react";
import type { CleanupFees } from "./CleanupScreen";
import { shortAddr } from "./ui";

const SECURITY_POINTS = [
  "We never receive your private key.",
  "We never ask for your seed phrase.",
  "Nothing happens until you sign.",
  "You approve the complete transaction.",
];

/**
 * FINAL REVIEW — the trust screen. The user sees exactly what will
 * happen in human language, then the raw transaction details below it.
 *
 * SIGNING GATE (fail closed): the Confirm button stays disabled until the
 * transaction has been simulated (dry-run) and the treasury is configured.
 */
export default function FinalReviewScreen({
  removeCount,
  keepCount,
  totalObjects,
  selectedCount,
  fees,
  treasury,
  demo,
  simulationVerified,
  treasuryMissing,
  simulationError,
  pipelineCommands,
  onConfirm,
  onBack,
}: {
  /** objects that will actually receive a transaction command */
  removeCount: number;
  keepCount: number;
  totalObjects: number;
  /** how many objects the user selected — may exceed removeCount when the
      builder honestly keeps some (lone dust, unverified burns, no swap route) */
  selectedCount?: number;
  fees: CleanupFees;
  treasury: string;
  demo: boolean;
  /** real mode: dry-run simulation succeeded */
  simulationVerified?: boolean;
  /** real mode: no treasury configured — must not sign */
  treasuryMissing?: boolean;
  /** real error from the failed simulation/planning — shown instead of a generic reason */
  simulationError?: string | null;
  /** detailed pipeline log (withdraw → merge → swap → fee) for the final review */
  pipelineCommands?: string[];
  onConfirm: () => void;
  onBack: () => void;
}) {
  const [showTech, setShowTech] = useState(false);

  const canSign = demo || (simulationVerified && !treasuryMissing);
  const gateReason = !canSign
    ? treasuryMissing
      ? "Signing is disabled — the service treasury is not configured (set SERVICE_FEE_ADDRESS in the server environment)."
      : simulationError
        ? `Simulation failed — signing stays disabled. Reason: ${simulationError}`
        : "Signing is disabled until the transaction is simulated successfully."
    : undefined;

  return (
    <div className="final-review-vault" data-final="ready">
      {/* Header */}
      <div className="frv-header">
        <div className="frv-badge-row">
          <span className="frv-eyebrow">FINAL REVIEW</span>
          {demo ? (
            <span className="frv-mode-badge demo">SIMULATION MODE</span>
          ) : (
            <span className="frv-mode-badge onchain">ON-CHAIN VERIFIED</span>
          )}
        </div>
        <h2 className="frv-title">
          One last <span className="frv-highlight">look.</span>
        </h2>
        <p className="frv-sub">
          You are about to remove <strong className="frv-count-num">{removeCount}</strong> item{removeCount === 1 ? "" : "s"} from your Sui wallet.
        </p>
        {selectedCount != null && removeCount < selectedCount && (
          <p className="frv-skip-note" data-testid="skip-note">
            {selectedCount - removeCount} of your selected object{selectedCount - removeCount === 1 ? " is" : "s are"} kept untouched
            — no verified cleanup action applies to {selectedCount - removeCount === 1 ? "it" : "them"} (e.g. a lone dust coin with
            nothing to merge into, or an unverified burn). The wallet preview will match this
            smaller number.
          </p>
        )}
      </div>

      {/* Summary card */}
      <div className="frv-card">
        <div className="frv-card-title">OBJECT INVENTORY SUMMARY</div>
        <div className="frv-summary-grid">
          <div className="frv-row">
            <span className="frv-row-label">You are removing</span>
            <span className="frv-row-value remove">{removeCount} items</span>
          </div>
          <div className="frv-row">
            <span className="frv-row-label">You are keeping</span>
            <span className="frv-row-value keep">{keepCount} items</span>
          </div>
          <div className="frv-row">
            <span className="frv-row-label">Wallet balance</span>
            <span className="frv-row-value muted">Unchanged</span>
          </div>
          <div className="frv-row">
            <span className="frv-row-label">Protected items</span>
            <span className="frv-row-value muted">Unchanged</span>
          </div>
          <div className="frv-row">
            <span className="frv-row-label">Valuable items</span>
            <span className="frv-row-value muted">Unchanged</span>
          </div>
          <div className="frv-row total-line">
            <span className="frv-row-label">Total wallet items</span>
            <span className="frv-row-value total">{totalObjects} items</span>
          </div>
        </div>
      </div>

      {/* Transaction & Fee Card — PRE-SIGN estimate (actuals only after confirmation) */}
      <div className="frv-card">
        <div className="frv-card-title">TRANSACTION SPECIFICATION (ESTIMATED)</div>
        <div className="frv-tx-grid">
          <div className="frv-tx-row">
            <span className="frv-tx-label">Network</span>
            <span className="frv-tx-value">Sui Mainnet</span>
          </div>
          <div className="frv-tx-row">
            <span className="frv-tx-label">Action</span>
            <span className="frv-tx-value">
              Clean {removeCount} item{removeCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="frv-divider" />

          {/* Honest financial result — the ONE estimate block on this screen:
              NET RESULT = storage rebate − network gas − cleaner fee. */}
          {fees.storageRebateSui != null && fees.storageRebateSui !== "" && fees.storageRebateSui !== "0" && (
            <div className="frv-tx-row rebate-row">
              <span className="frv-tx-label">Storage rebate</span>
              <span className="frv-tx-value mono green">+{fees.storageRebateSui} SUI</span>
            </div>
          )}
          <div className="frv-tx-row">
            <span className="frv-tx-label">Network gas</span>
            <span className="frv-tx-value mono">−{fees.networkGasSui ?? fees.networkFeeSui ?? "—"} SUI</span>
          </div>
          <div className="frv-tx-row">
            <span className="frv-tx-label">SuiCleaner fee (flat)</span>
            <span className="frv-tx-value mono">−{fees.cleanerFeeSui ?? "—"} SUI</span>
          </div>
          <div className="frv-tx-row total-highlight">
            <span className="frv-tx-label">Estimated net result</span>
            <span className={`frv-tx-value mono val-net ${fees.netResultSui?.startsWith("-") ? "val-negative" : ""}`}>
              {fees.netResultSui ?? "—"} SUI
            </span>
          </div>
          <p className="frv-estimate-note">
            This is an estimate. The final amount depends on the actual transaction effects.
          </p>

          <div className="frv-tx-row">
            <span className="frv-tx-label">Protocol Treasury</span>
            <span className="frv-tx-value mono-sm">
              {treasuryMissing ? "Not configured" : shortAddr(treasury)}
            </span>
          </div>
        </div>

        {demo && (
          <div className="frv-note demo">Simulation mode — no real transaction will be broadcast.</div>
        )}
        {!demo && simulationVerified && (
          <div className="frv-note verified">✓ Simulation verified — dry-run succeeded on-chain.</div>
        )}
      </div>

      {/* Technical details toggle */}
      <button className="frv-tech-toggle" type="button" onClick={() => setShowTech((v) => !v)}>
        <span>{showTech ? "− Hide technical details" : "+ Show technical details"}</span>
      </button>
      {showTech && (
        <div className="frv-tech-details">
          <p className="frv-tech-line">
            One atomic transaction is built: {removeCount} verified cleanup action{removeCount === 1 ? "" : "s"} + protocol fee transfer. You review and sign once.
          </p>
          <p className="frv-tech-line">
            Protected and valuable objects are strictly excluded from execution.
          </p>
          <p className="frv-tech-line">
            The transaction was simulated against the Sui network prior to signing. Network fee reflects simulated dry-run execution.
          </p>
          {pipelineCommands && pipelineCommands.length > 0 && (
            <ol className="frv-pipeline-log">
              {pipelineCommands.map((c, i) => (
                <li key={i} className="frv-pipeline-line">
                  {c}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Security assurances */}
      <div className="frv-security-card">
        <div className="frv-security-title">NON-CUSTODIAL SAFETY GUARANTEES</div>
        <ul className="frv-security-list">
          {SECURITY_POINTS.map((s) => (
            <li key={s}>
              <span className="frv-check">✓</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {gateReason && <p className="frv-gate-note">⚠ {gateReason}</p>}

      {/* Actions */}
      <div className="frv-actions">
        <button className="frv-btn-sec" data-act="back" onClick={onBack} type="button">
          ← BACK TO CLEANUP
        </button>
        <button
          className="frv-btn-pri"
          data-act="confirm"
          onClick={onConfirm}
          disabled={!canSign}
          type="button"
        >
          CONFIRM &amp; SIGN →
        </button>
      </div>
    </div>
  );
}
