import { Lock, ShieldCheck, Zap, AlertTriangle } from "lucide-react";
import { shortAddr } from "./ui";

/** one selected object that failed the pre-sign revalidation (fail-closed) */
export interface SignBlocker {
  objectId: string;
  reasons: string[];
  changes?: { field: string; before?: string; after?: string }[];
}

/**
 * Two-phase sign screen:
 *
 * Phase 1 — READY TO SIGN
 *   Shows: summary (remove/keep), fee breakdown, treasury address,
 *          "OPEN WALLET" button.
 *   The wallet is NOT open yet. The user clicks OPEN WALLET to proceed.
 *
 * Phase 2 — WAITING FOR WALLET
 *   Shows: status indicator, "WAITING FOR WALLET" headline,
 *          instruction to review in the wallet popup.
 *   The native wallet extension is open. The app waits for the result.
 */
export default function SignScreen({
  phase,
  removeCount,
  keepCount,
  networkFeeSui,
  cleanerFeeSui,
  storageRebateSui,
  networkGasSui,
  netResultSui,
  treasury,
  demo,
  blockers,
  onOpenWallet,
  onBack,
  onCancel,
  onBlockerBack,
  onBlockerRescan,
}: {
  /** which phase to render */
  phase: "ready" | "waiting";
  removeCount: number;
  keepCount: number;
  networkFeeSui: string | null;
  cleanerFeeSui: string | null;
  storageRebateSui?: string | null;
  networkGasSui?: string | null;
  netResultSui?: string | null;
  treasury: string;
  demo: boolean;
  /** selected objects that failed pre-sign revalidation (fail-closed) */
  blockers?: SignBlocker[];
  /** called when user clicks OPEN WALLET (phase 1) */
  onOpenWallet: () => void;
  /** back to final review (phase 1 only) */
  onBack?: () => void;
  /** cancel while waiting for the wallet (phase 2) */
  onCancel?: () => void;
  /** from the blocker panel: return to the cleanup selection */
  onBlockerBack?: () => void;
  /** from the blocker panel: re-scan the wallet */
  onBlockerRescan?: () => void;
}) {
  if (phase === "waiting") {
    return (
      <div className="sign-vault-screen" data-sign="waiting">
        <div className="sign-vault-card waiting-card">
          {/* Compact waiting indicator — one small icon, no decorative rings/radar */}
          <div className="sign-vault-wait-mark" aria-hidden="true">
            <Lock size={15} strokeWidth={2.1} />
          </div>

          <div className="sign-vault-header">
            <div className="sign-vault-eyebrow">AWAITING AUTHORIZATION</div>
            <h1 className="sign-vault-title">WAITING FOR WALLET</h1>
            <p className="sign-vault-subtitle">
              Review the transaction in your wallet extension window and click approve.
            </p>
          </div>

          {/* Dots animation */}
          <div className="sign-vault-dots">
            <span className="sign-vault-dot" />
            <span className="sign-vault-dot" />
            <span className="sign-vault-dot" />
          </div>

          <div className="sign-vault-reassurance">
            <ShieldCheck size={16} strokeWidth={2} className="sign-reassurance-shield" />
            <span className="sign-reassurance-text">
              Nothing happens until you approve in your wallet.
            </span>
          </div>

          <p className="sign-vault-note">
            If you reject or close the transaction window, you will be safely returned to the review screen.
          </p>

          {onCancel && (
            <button className="sign-vault-btn-sec waiting-cancel" data-act="cancel-waiting" onClick={onCancel} type="button">
              CLOSE WALLET REQUEST
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Phase 1: READY TO SIGN ──
  // If the pre-sign revalidation blocked the selection (fail-closed), show a
  // focused blocker panel instead of the generic bottom error bar: which
  // objects changed, what changed, and what to do next.
  if (blockers && blockers.length > 0) {
    return (
      <div className="sign-vault-screen" data-sign="blocked">
        <div className="sign-vault-card blocker-card" role="alert">
          <div className="sign-blocker-head">
            <AlertTriangle size={22} strokeWidth={2} className="sign-blocker-icon" />
            <div>
              <div className="sign-blocker-eyebrow">SIGNING BLOCKED</div>
              <h1 className="sign-blocker-title">Some selected objects changed before signing.</h1>
            </div>
          </div>
          <p className="sign-blocker-sub">
            Objects are revalidated against the chain right before signing. The transaction was not
            built and your wallet was not opened — nothing was sent.
          </p>

          <div className="sign-blocker-list">
            {blockers.map((b) => (
              <div key={b.objectId} className="sign-blocker-item">
                <div className="sign-blocker-obj">{shortAddr(b.objectId)}</div>
                {b.changes && b.changes.length > 0 ? (
                  <ul className="sign-blocker-changes">
                    {b.changes.map((c, i) => (
                      <li key={i} className="sign-blocker-change">
                        <span className="sign-blocker-field">{c.field}</span>
                        <span className="sign-blocker-before">Before: {c.before ?? "—"}</span>
                        <span className="sign-blocker-after">Current: {c.after ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="sign-blocker-changes">
                    {b.reasons.map((r) => (
                      <li key={r} className="sign-blocker-reason">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="sign-blocker-actions">
            <button className="sign-vault-btn-sec" data-act="blocker-back" onClick={onBlockerBack} type="button">
              BACK TO CLEANUP
            </button>
            <button className="sign-vault-btn-pri" data-act="blocker-rescan" onClick={onBlockerRescan} type="button">
              RESCAN WALLET
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sign-vault-screen" data-sign="ready">
      <div className="sign-vault-card ready-card">
        {/* Header */}
        <div className="sign-vault-header">
          <div className="sign-vault-eyebrow">TRANSACTION AUTHORIZATION</div>
          <h1 className="sign-vault-title">READY TO SIGN</h1>
          <p className="sign-vault-subtitle">
            Your wallet will open a secure approval window. Review details before opening.
          </p>
        </div>

        {/* Objects Summary Card — the pre-sign TRANSACTION SUMMARY */}
        <div className="sign-vault-section-card">
          <div className="sign-vault-section-title">TRANSACTION SUMMARY</div>
          <div className="sign-vault-row">
            <span className="sign-vault-label">Objects to remove</span>
            <span className="sign-vault-value remove">
              {removeCount} object{removeCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="sign-vault-row">
            <span className="sign-vault-label">Objects remaining</span>
            <span className="sign-vault-value keep">
              {keepCount} object{keepCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Financial & Fee Card — PRE-SIGN estimate (actuals only after confirmation) */}
        <div className="sign-vault-section-card">
          <div className="sign-vault-section-title">FEE &amp; SETTLEMENT BREAKDOWN (ESTIMATED)</div>
          {storageRebateSui != null && storageRebateSui !== "" && (
            <div className="sign-vault-row">
              <span className="sign-vault-label">Storage rebate</span>
              <span className="sign-vault-value mono green">+{storageRebateSui} SUI</span>
            </div>
          )}
          <div className="sign-vault-row">
            <span className="sign-vault-label">{demo ? "Demo network estimate" : "Network gas"}</span>
            <span className="sign-vault-value mono">
              −{networkGasSui ?? networkFeeSui ?? "Estimating…"} SUI
            </span>
          </div>
          <div className="sign-vault-row">
            <span className="sign-vault-label">SuiCleaner protocol fee (flat)</span>
            <span className="sign-vault-value mono">
              −{cleanerFeeSui ?? "Estimating…"} SUI
            </span>
          </div>

          <div className="sign-vault-divider" />

          <div className="sign-vault-row total-row">
            <span className="sign-vault-label total-lbl">Estimated net result</span>
            <span className={`sign-vault-value mono total-val ${netResultSui?.startsWith("-") ? "val-negative" : "val-positive"}`}>
              {netResultSui ?? "Estimating…"} SUI
            </span>
          </div>

          <div className="sign-vault-row">
            <span className="sign-vault-label">Protocol Treasury</span>
            <span className="sign-vault-value mono-sm">
              {shortAddr(treasury)}
            </span>
          </div>

          <p className="sign-vault-estimate-note">
            Estimated — the final amount depends on the actual on-chain transaction effects.
          </p>
        </div>

        {/* Wallet expectation — what the wallet popup will actually present.
            Real mode only: in demo no wallet opens. Deliberately does NOT claim
            the rebate shows as its own line — each wallet renders the
            transaction its own way. */}
        {!demo && (
          <div className="sign-vault-wallet-note" data-testid="wallet-expectation">
            <div className="sign-vault-wallet-note-title">WHAT YOU&rsquo;LL SEE IN YOUR WALLET</div>
            <p className="sign-vault-wallet-note-text">
              Your wallet may show the Cleaner fee as an outgoing SUI transfer.
              The storage rebate is released by the Sui transaction when the selected
              objects are removed — your wallet decides how to present it.
            </p>
            {netResultSui != null && netResultSui !== "" && (
              <div className="sign-vault-wallet-note-result">
                <span>Estimated net result</span>
                <span className={`sign-vault-wallet-note-val ${netResultSui.startsWith("-") ? "neg" : "pos"}`}>
                  {netResultSui} SUI
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-custodial guarantee badge */}
        <div className="sign-vault-reassurance">
          <ShieldCheck size={16} strokeWidth={2} className="sign-reassurance-shield" />
          <span className="sign-reassurance-text">
            {demo
              ? "Simulation demo mode — no real transaction will be broadcast."
              : "Nothing happens until you approve in your wallet."}
          </span>
        </div>

        {/* Primary & Secondary Actions */}
        <div className="sign-vault-actions">
          {onBack && (
            <button
              className="sign-vault-btn-sec"
              data-act="back-to-review"
              onClick={onBack}
              type="button"
            >
              ← BACK
            </button>
          )}
          <button
            className="sign-vault-btn-pri"
            data-act="open-wallet"
            onClick={onOpenWallet}
            type="button"
          >
            <Zap size={14} strokeWidth={2.2} />
            <span>{demo ? "SIMULATE SIGN" : "OPEN WALLET & APPROVE"}</span>
          </button>
        </div>

        <p className="sign-vault-note">
          By signing, you authorize this specific cleanup transaction only.
          Your private keys never leave your device.
        </p>
      </div>
    </div>
  );
}
