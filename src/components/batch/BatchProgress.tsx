/**
 * Batch progress — counts, bar, cancel. Cancelled runs keep what settled.
 */

import type { BatchProgress as Progress } from "../../batch/batchScanner";

export default function BatchProgress({
  progress,
  onCancel,
}: {
  progress: Progress;
  onCancel: () => void;
}) {
  const pct = progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100);
  return (
    <div className="batch-screen" data-batch="progress">
      <h2 className="report-title">Batch scan.</h2>
      <p className="final-sub">Scanning wallets… {progress.done} / {progress.total}</p>

      <div className="batch-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="batch-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="final-sub">Progress {pct}%</p>

      <div className="batch-stats">
        <span>Successful: <b>{progress.ok}</b></span>
        <span>Failed: <b>{progress.failed}</b></span>
        <span>Remaining: <b>{progress.remaining}</b></span>
      </div>

      <div className="batch-actions">
        <button className="btn btn-secondary" data-act="cancel-batch" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
