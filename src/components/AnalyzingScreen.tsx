import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Radio,
  Layers,
  Coins,
  Zap,
  ShieldCheck,
  Terminal,
  Check,
} from "lucide-react";
import type { WalletObject } from "../scanner/objectClassifier";

interface ScanStep {
  id: string;
  label: string;
  detail: string;
}

const SCAN_STEPS: ScanStep[] = [
  { id: "rpc", label: "Connecting to Sui RPC", detail: "Querying fullnode & graph indexers" },
  { id: "objects", label: "Excavating On-Chain Objects", detail: "Reading Move structures & capabilities" },
  { id: "meta", label: "Resolving Token Metadata & Logos", detail: "Fetching symbols, decimals & verified assets" },
  { id: "rebates", label: "Calculating Storage Rebates", detail: "Identifying empty coin objects & reclaimable storage" },
  { id: "security", label: "Checking Security & Protocols", detail: "Verifying system caps, DeFi obligations & spam registry" },
];

function StepIcon({ id }: { id: string }) {
  switch (id) {
    case "rpc":
      return <Radio size={16} strokeWidth={2} />;
    case "objects":
      return <Layers size={16} strokeWidth={2} />;
    case "meta":
      return <Coins size={16} strokeWidth={2} />;
    case "rebates":
      return <Zap size={16} strokeWidth={2} />;
    case "security":
      return <ShieldCheck size={16} strokeWidth={2} />;
    default:
      return <Activity size={16} strokeWidth={2} />;
  }
}

const LIVE_LOGS = [
  "[RPC] Connecting to Sui RPC and reading object references",
  "[INDEXER] Fetching object references and coin balances for target address",
  "[MOVE] Excavating Move package types and fields",
  "[CLASSIFIER] Identifying empty coin objects, dust and removables",
  "[SECURITY] Applying protection rules (staking, kiosk caps, spam registry)",
  "[OK] Object inventory assembled — showing your report",
];

export default function AnalyzingScreen({
  label,
  objects = [],
  onComplete,
  simulated,
}: {
  label?: string;
  /** Real scan objects */
  objects?: WalletObject[];
  onComplete?: () => void;
  /** demo data — badge the screen as SIMULATED so it never reads as live */
  simulated?: boolean;
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(15);
  const [logIndex, setLogIndex] = useState(1);

  // Telemetry is derived from the actual scan results only. Before the first
  // page arrives the values are "—" — never fake numbers from an old dataset.
  const stats = useMemo(() => {
    const hasData = objects.length > 0;
    const total = hasData ? objects.length : null;
    const emptyCoins = hasData ? objects.filter((o) => o.coinBalance === "0").length : null;
    const nfts = hasData ? objects.filter((o) => o.category === "nft").length : null;
    const rebate = hasData && emptyCoins != null ? (emptyCoins * 0.0028).toFixed(3) : null;
    return { total, emptyCoins, rebate, nfts };
  }, [objects]);

  useEffect(() => {
    let active = true;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => {
      if (active) timers.push(window.setTimeout(fn, ms));
    };

    SCAN_STEPS.forEach((step, idx) => {
      const stepTime = 300 + idx * 350;
      later(() => {
        setActiveStepIndex(idx);
        setProgress(Math.min(95, 20 + idx * 18));
      }, stepTime);

      later(() => {
        setCompletedSteps((prev) => new Set([...prev, step.id]));
      }, stepTime + 320);
    });

    // Animate log lines
    LIVE_LOGS.forEach((_, idx) => {
      later(() => {
        setLogIndex(idx + 1);
      }, 250 + idx * 320);
    });

    const finishTime = 300 + SCAN_STEPS.length * 350 + 200;
    later(() => {
      setProgress(100);
    }, finishTime);

    later(() => {
      if (onComplete) onComplete();
    }, finishTime + 450);

    return () => {
      active = false;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [onComplete]);

  return (
    <div className="cyber-scanner-cockpit" data-testid="analyzing-screen">
      {/* Background glow effects */}
      <div className="cockpit-glow-flare flare-cyan" />
      <div className="cockpit-glow-flare flare-gold" />

      <div className="cockpit-grid">
        {/* LEFT COLUMN: Telemetry & Live Asset Metrics */}
        <aside className="cockpit-sidebar left-sidebar">
          <div className="cockpit-card">
            <div className="cockpit-card-header">
              <Activity size={16} strokeWidth={2.2} className="cockpit-card-icon" />
              <span className="cockpit-card-title">ON-CHAIN TELEMETRY</span>
            </div>

            <div className="cockpit-stats-list">
              <div className="cockpit-stat-item">
                <span className="cockpit-stat-lbl">TOTAL OBJECTS</span>
                <span className="cockpit-stat-val val-cyan">{stats.total ?? "—"}</span>
              </div>
              <div className="cockpit-stat-item">
                <span className="cockpit-stat-lbl">EMPTY COIN OBJECTS</span>
                <span className="cockpit-stat-val val-gold">{stats.emptyCoins ?? "—"}</span>
              </div>
              <div className="cockpit-stat-item">
                <span className="cockpit-stat-lbl">EST. RECLAIMABLE</span>
                <span className="cockpit-stat-val val-mint">
                  {stats.rebate != null ? `+${stats.rebate} SUI` : "—"}
                </span>
              </div>
            </div>

            <div className="cockpit-divider" />

            <div className="cockpit-diagnostics">
              <div className="diag-row">
                <span className="diag-label">RPC Endpoint</span>
                <span className="diag-val">Sui Network</span>
              </div>
              <div className="diag-row">
                <span className="diag-label">Mode</span>
                <span className="diag-val cyan">{simulated ? "Simulated" : "Live"}</span>
              </div>
              <div className="diag-row">
                <span className="diag-label">Execution</span>
                <span className="diag-val cyan">Read-only</span>
              </div>
              <div className="diag-row">
                <span className="diag-label">Key Custody</span>
                <span className="diag-val green">100% Client-Side</span>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Main Scanner & Progress (NO DECORATIVE CIRCLE/SPHERE) */}
        <main className="cockpit-center">
          <div className="scanner-card">
            <div className="scanner-kicker">
              <span>SUI ON-CHAIN INTELLIGENCE ENGINE</span>
              {simulated ? (
                <span className="scanner-mode-badge simulated" data-mode="simulated">SIMULATED DEMO DATA</span>
              ) : (
                <span className="scanner-mode-badge live" data-mode="live">LIVE SCAN</span>
              )}
            </div>
            <h1 className="scanner-title">ANALYZING YOUR WALLET</h1>
            <p className="scanner-subtitle">
              {label || "Inspecting ownership, resolving verified token metadata, and calculating storage rebates..."}
            </p>

            {/* Progress Bar */}
            <div className="scanner-progress-container">
              <div className="scanner-progress-bar">
                <div className="scanner-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="scanner-progress-meta">
                <span className="scanner-progress-text">
                  {progress < 100 ? `SCANNING ON-CHAIN OBJECTS (${progress}%)` : "ANALYSIS COMPLETE"}
                </span>
                <span className="scanner-progress-status">
                  <span className="scanner-pulse-dot" /> {progress < 100 ? "SCAN IN PROGRESS" : "DONE"}
                </span>
              </div>
            </div>

            {/* Live Step-by-Step Checklist */}
            <div className="scanner-steps-grid">
              {SCAN_STEPS.map((step, i) => {
                const isDone = completedSteps.has(step.id);
                const isCurrent = activeStepIndex === i && !isDone;

                return (
                  <div
                    key={step.id}
                    className={`scanner-step-item ${isDone ? "step-done" : isCurrent ? "step-active" : "step-pending"}`}
                  >
                    <div className="step-icon-wrap">
                      {isDone ? (
                        <Check size={14} strokeWidth={2.5} className="step-check-icon" />
                      ) : (
                        <StepIcon id={step.id} />
                      )}
                    </div>
                    <div className="step-content">
                      <div className="step-title">{step.label}</div>
                      <div className="step-detail">{step.detail}</div>
                    </div>
                    <div className="step-badge">
                      {isDone ? "RESOLVED" : isCurrent ? "SCANNING…" : "QUEUED"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Terminal Log Stream - Visually secondary */}
            <div className="cockpit-terminal">
              <div className="cockpit-terminal-header">
                <div className="cockpit-terminal-dots">
                  <span className="cockpit-terminal-dot red" />
                  <span className="cockpit-terminal-dot yellow" />
                  <span className="cockpit-terminal-dot green" />
                </div>
                <div className="cockpit-terminal-title-wrap">
                  <Terminal size={12} strokeWidth={2} />
                  <span className="cockpit-terminal-title">LIVE PROTOCOL ACTIVITY STREAM</span>
                </div>
              </div>
              <div className="cockpit-terminal-body">
                {LIVE_LOGS.slice(0, logIndex).map((log, idx) => (
                  <div key={idx} className="cockpit-log-line">
                    <span className="log-prefix">&gt;</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: Storage Rebate Economics & Protocol Guarantees */}
        <aside className="cockpit-sidebar right-sidebar">
          <div className="cockpit-card">
            <div className="cockpit-card-header">
              <ShieldCheck size={16} strokeWidth={2.2} className="cockpit-card-icon" />
              <span className="cockpit-card-title">SAFETY &amp; PROTOCOL GUARANTEES</span>
            </div>

            <div className="cockpit-guide-block">
              <div className="guide-title">How Storage Rebates Work</div>
              <p className="guide-text">
                Every on-chain Sui object reserves storage fees. When an empty coin object or other deletable object is removed, the Sui blockchain returns most of that storage fee to your wallet. Removing an NFT via burn does not return a rebate.
              </p>
            </div>

            <div className="cockpit-divider" />

            <div className="cockpit-safety-list">
              <div className="safety-point">
                <span className="safety-check">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                <div className="safety-point-text">
                  <strong>Zero Key Access:</strong> Private keys never leave your browser extension.
                </div>
              </div>
              <div className="safety-point">
                <span className="safety-check">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                <div className="safety-point-text">
                  <strong>Dry-Run Simulated:</strong> Every transaction is simulated before you sign.
                </div>
              </div>
              <div className="safety-point">
                <span className="safety-check">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                <div className="safety-point-text">
                  <strong>Valuables Shielded:</strong> active balances, protected objects and valuable NFTs are never touched. Junk NFTs are only removed when you review them.
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
