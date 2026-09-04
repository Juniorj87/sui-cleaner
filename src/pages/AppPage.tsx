import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useCurrentAccount, useDisconnectWallet, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useFlow } from "../flow/useFlow";
import {
  demoScan,
  scanWallet,
  scanWalletReadonly,
  ScanError,
  type ScanResult,
} from "../scanner/walletScanner";
import ErrorNotice, { type ErrorCode } from "../components/ErrorNotice";
import AnalyzingScreen from "../components/AnalyzingScreen";
import ReadOnlyScreen from "../components/ReadOnlyScreen";
import CleanerDesk from "../components/workspace/CleanerDesk";
import QueuePanel from "../components/workspace/QueuePanel";
import AppTopBar from "../components/workspace/AppTopBar";
import AISetup from "../components/workspace/AISetup";
import AIAssistant from "../components/workspace/AIAssistant";
import PortfolioPanel from "../components/workspace/PortfolioPanel";
import VaultBanner from "../components/workspace/VaultBanner";
import TrustBanner from "../components/workspace/TrustBanner";
import "../styles/workspace-vault.css";
import AddressMismatch from "../components/AddressMismatch";
import CleanupScreen from "../components/CleanupScreen";
import FinalReviewScreen from "../components/FinalReviewScreen";
import SignScreen, { type SignBlocker } from "../components/SignScreen";
import SuccessScreen from "../components/SuccessScreen";
import { planCleanup, type CleanupPlan } from "../cleanup/cleanupEngine";
import { verifyPostTransaction, type VerificationResult } from "../cleanup/postTxVerifier";
import { treasuryDisplay } from "../fees/treasury";
import { mistToSui, DEMO_NETWORK_FEE_MIST } from "../fees/gasEstimator";
import { SERVICE_FEE_MIST, SERVICE_FEE_SUI_DISPLAY } from "../fees/serviceFeeConfig";
import { storageRebateSui } from "../lib/walletGroups";
import { isSuiAddress, normalizeAddress } from "../lib/suiAddress";
import { suiscanTxUrl } from "../lib/suiscan";
import { useConnectAction } from "../lib/useConnectAction";
import { getNetwork } from "../config";
import { useAIKey } from "../ai/useAIKey";
import type { WalletObject } from "../scanner/objectClassifier";

/** post-transaction verification result */
interface TxResult {
  digest?: string;
  requestedIds: string[];
  /** objects the transaction ACTUALLY deleted on-chain (from effects.deleted / objectChanges) */
  removedIds: string[];
  remainingIds: string[];
  unexpectedChanges: string[];
  /**
   * verification outcome — driven by effects.status.status only:
   *   "success" / "state-differs" → confirmed on-chain (state-differs has notes)
   *   "failure"                 → the chain rejected the transaction
   *   "verification-failed"     → result could NOT be verified (RPC/network/unknown)
   */
  status: "success" | "state-differs" | "failure" | "verification-failed";
  /** object count before (from the scan) */
  before: number;
  /** object count after the re-scan (informational) */
  after: number;
  /** actual net gas used (in SUI) from effects.gasUsed */
  gasUsedSui?: string;
  /** ACTUAL storage rebate (in SUI) from effects.gasUsed.storageRebate */
  storageRebateSui?: string;
  /** ACTUAL gross network gas (computation + storage, in SUI) from effects */
  grossGasSui?: string;
  /** ACTUAL net result — the sender's on-chain SUI balance change, signed */
  netResultSui?: string;
  /** detailed verification result from the verifier */
  verification?: VerificationResult;
  /** human-readable notes (shown on the success screen; never flip success to failed) */
  discrepancies?: string[];
  /** treasury verification result */
  treasuryVerified?: boolean;
  treasuryReceivedSui?: string;
  /** on-chain effects status: "success" | "failure" | "unknown" | "fetch-failed" */
  effectsStatus?: string;
}

/** screens where the left nav is visible but non-interactive */
const NAV_GHOSTED = new Set(["analyzing", "sign", "success", "cancelled", "failed"]);

/**
 * The product at /app — ONE persistent workspace:
 *   slim top bar → narrow left nav → one huge central work area.
 *
 * Every flow state (analyzing, summary, categories, object dossier,
 * review, cleanup, final look, signing, success) happens inside this
 * same workspace. Three modes:
 *  - READ-ONLY SCAN: paste any Sui address, inspect freely, cleanup locked
 *  - CONNECTED CLEANUP: analyze your own wallet, review, and sign the real transaction
 *  - DEMO: the fictional 47-item wallet, fully simulated
 */
export default function AppPage() {
  const flow = useFlow();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [params] = useSearchParams();
  const connect = useConnectAction((code) => setError(code));
  const { mutate: disconnect } = useDisconnectWallet();
  const signTx = useSignAndExecuteTransaction();
  const aiKey = useAIKey();

  const demo = useMemo(() => demoScan(), []);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [mode, setMode] = useState<"demo" | "onchain" | "readonly" | null>(null);
  const [scannedAddress, setScannedAddress] = useState<string | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  /** real error from the last failed plan/simulation — shown instead of a generic gate message */
  const [planError, setPlanError] = useState<string | null>(null);
  const [cleaned, setCleaned] = useState(false);
  const [showMismatch, setShowMismatch] = useState(false);
  const [txResult, setTxResult] = useState<TxResult | null>(null);
  const [navCategory, setNavCategory] = useState<"all" | "portfolio">("all");
  const [showAISetup, setShowAISetup] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiFocusObject, setAiFocusObject] = useState<WalletObject | null>(null);

  const openAIAssistant = useCallback((obj?: WalletObject) => {
    setAiFocusObject(obj ?? null);
    setShowAIAssistant(true);
  }, []);
  const demoTimer = useRef<number | null>(null);
  const queueRef = useRef<HTMLDivElement | null>(null);

  // No wallet data until a REAL scan/demo exists — a fresh /app must be empty.
  // Demo data is ONLY used after the user explicitly clicks TRY DEMO.
  const objects = scan?.objects ?? [];

  // Vault banner derived data — ONE rebate truth: only actions that free
  // storage pay a rebate (empty-coin destroy / dust merge). NFT & object
  // burns return none, so they are never counted as rebate value.
  const cleanableObjects = useMemo(() => objects.filter((o) => !!o.cleanupAction && !o.protected), [objects]);
  const cleanableCount = cleanableObjects.length;
  const totalRebateSui = useMemo(() => {
    if (plan?.gasBreakdown?.storageRebate) return mistToSui(plan.gasBreakdown.storageRebate);
    const sum = cleanableObjects.reduce((acc, o) => acc + storageRebateSui(o), 0);
    return sum > 0 ? sum.toFixed(4) : "0.0000";
  }, [plan, cleanableObjects]);

  /**
   * Objects the user may bulk-select — the same rule the table's
   * SELECT ALL CLEANABLE uses: verified action, classification cleanable,
   * never protected, never review/suspicious (those need inspection first).
   */
  const selectableTargets = useMemo(
    () =>
      objects.filter(
        (o) =>
          !!o.cleanupAction &&
          !o.protected &&
          o.classification !== "protected" &&
          o.classification !== "review" &&
          o.classification !== "suspicious"
      ),
    [objects]
  );

  const handleQuickClean = useCallback(() => {
    const emptyIds = objects.filter((o) => o.coinBalance === "0" && o.cleanupAction === "delete").map((o) => o.objectId);
    if (emptyIds.length > 0) {
      flow.selectMany(emptyIds);
      if (flow.screen === "report" || flow.screen === "explore") {
        flow.go("explore");
        setNavCategory("all");
      }
    }
  }, [objects, flow]);

  /**
   * Selection vs. the current scan: when a re-scan drops objects that were
   * previously selected, ONLY those missing ids leave the selection. The
   * rest of the user's review stays intact — a refresh must never wipe the
   * whole cleanup queue while the user is mid-review.
   */
  const selectionKey = useMemo(() => [...flow.selected].sort().join("|"), [flow.selected]);

  useEffect(() => {
    if (objects.length > 0 && flow.selected.size > 0) {
      const missing = [...flow.selected].filter((id) => !objects.some((o) => o.objectId === id));
      if (missing.length > 0) {
        flow.deselectMany(missing);
        console.log(`Dropped ${missing.length} stale selection(s) no longer present in the scan.`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, selectionKey]);

  // ---------- Portfolio → Cleanup bridge (coinType-primary + objectId direct) ----------
  function normalizeCoinType(value: string): string {
    return value.trim().toLowerCase();
  }
  function unwrapCoinType(value: string): string {
    const m = value.match(/^0x2::coin::coin<(.+)>$/i);
    return m ? m[1].toLowerCase() : value.toLowerCase();
  }
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.tokens?.length) return;
      const selectedTokens: Array<{ symbol: string; name: string; category: string; coinType?: string; objectId?: string | null }> = detail.tokens;
      const idsToAdd: string[] = [];
      const scannedIds = new Set(objects.map(o => o.objectId));
      for (const pt of selectedTokens) {
        // Direct objectId if server provided and exists in scan
        if (pt.objectId && scannedIds.has(pt.objectId) && !idsToAdd.includes(pt.objectId)) {
          idsToAdd.push(pt.objectId);
          continue;
        }
        let matched = false;
        if (pt.coinType) {
          const portfolioType = unwrapCoinType(normalizeCoinType(pt.coinType));
          for (const obj of objects) {
            if (idsToAdd.includes(obj.objectId)) continue;
            const objectType = unwrapCoinType(normalizeCoinType(obj.type));
            // For coin objects, compare unwrapped inner; for non-coin, compare full normalized type
            const inner = obj.type.match(/^0x2::coin::Coin<(.+)>$/);
            const objInner = inner ? normalizeCoinType(inner[1]) : null;
            const isCoinMatch = objInner ? unwrapCoinType(objInner) === portfolioType : objectType === portfolioType;
            const containsMatch = !inner && objectType.includes(portfolioType);
            if (isCoinMatch || containsMatch) {
              idsToAdd.push(obj.objectId);
              matched = true;
            }
          }
          if (matched) continue;
        }
        // FALLBACK exact name equality only (no symbol substring)
        for (const obj of objects) {
          if (idsToAdd.includes(obj.objectId)) continue;
          const nameMatch = obj.name?.toLowerCase() === pt.symbol.toLowerCase() ||
            obj.name?.toLowerCase() === pt.name.toLowerCase();
          if (nameMatch) {
            idsToAdd.push(obj.objectId);
          }
        }
      }
      console.log("[Portfolio→Cleanup] requested", selectedTokens.map(t=>t.coinType), "matched", idsToAdd);
      if (idsToAdd.length > 0) {
        flow.selectMany(idsToAdd);
        if (flow.screen === "report" || flow.screen === "explore") {
          flow.go("explore");
          setNavCategory("all");
        }
      }
    };
    window.addEventListener("portfolio-add-cleanup", handler);
    return () => window.removeEventListener("portfolio-add-cleanup", handler);
  }, [objects, flow]);

  // ---------- browser tab title ----------
  useEffect(() => {
    document.title =
      mode === "demo"
        ? "Sui Cleaner — Demo"
        : mode === "readonly"
          ? "Sui Cleaner — Wallet Analysis"
          : mode === "onchain"
            ? "Sui Cleaner — App"
            : "Sui Cleaner — App";
  }, [mode]);

  // clear any pending demo timer on unmount
  useEffect(() => {
    return () => {
      if (demoTimer.current !== null) window.clearTimeout(demoTimer.current);
      if (walletTimeoutRef.current !== null) window.clearTimeout(walletTimeoutRef.current);
    };
  }, []);

  // ---------- deep links: /app?demo=true and /app?scan=0x… ----------
  // React StrictMode mounts effects twice in dev; scanToken makes duplicate
  // runs harmless (the last run wins, stale completions are ignored), and in
  // production builds the effect runs once anyway.
  const scanToken = useRef(0);

  useEffect(() => {
    const demoParam = params.get("demo");
    const scanParam = params.get("scan");
    if (demoParam === "true") {
      startDemo();
      return;
    }
    if (scanParam != null && scanParam !== "") {
      if (isSuiAddress(scanParam)) {
        startReadonly(normalizeAddress(scanParam));
      }
      return;
    }
    if (scanParam === "") setFocusInput(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const [focusInput, setFocusInput] = useState(false);

  // ---------- analysis entry ----------
  const startDemo = () => {
    const token = ++scanToken.current;
    setMode("demo");
    setScannedAddress(null);
    setScan(demo);
    setCleaned(false);
    setShowMismatch(false);
    setPlan(null);
    setTxResult(null);
    setNavCategory("all");
    setSignPhase("ready");
    flow.go("analyzing");
    if (demoTimer.current !== null) window.clearTimeout(demoTimer.current);
    demoTimer.current = window.setTimeout(() => {
      if (token !== scanToken.current) return;
      flow.go("report");
      demoTimer.current = null;
    }, 1500);
  };

  /** read-only scan of an arbitrary public address — via the same-origin proxy */
  const startReadonly = (address: string) => {
    const token = ++scanToken.current;
    setMode("readonly");
    setScannedAddress(normalizeAddress(address));
    setCleaned(false);
    setShowMismatch(false);
    setPlan(null);
    setTxResult(null);
    setNavCategory("all");
    setSignPhase("ready");
    flow.go("analyzing");
    scanWalletReadonly(address)
      .then((r) => {
        if (token !== scanToken.current) return;
        setScan(r);
        flow.go("report");
      })
      .catch((e: unknown) => {
        if (token !== scanToken.current) return;
        if (e instanceof ScanError) setError(e.code);
        else setError("scan-failed" as ErrorCode);
        flow.go("start");
      });
  };

  /** analyze the connected wallet (cleanup-enabled mode) */
  const startReal = () => {
    if (!account) {
      setError("wallet-not-connected");
      return;
    }
    const token = ++scanToken.current;
    setMode("onchain");
    setScannedAddress(normalizeAddress(account.address));
    setCleaned(false);
    setShowMismatch(false);
    setPlan(null);
    setTxResult(null);
    setNavCategory("all");
    setSignPhase("ready");
    flow.go("analyzing");
    scanWallet(client, account.address)
      .then((r) => {
        if (token !== scanToken.current) return;
        setScan(r);
        flow.go("report");
      })
      .catch((e: unknown) => {
        if (token !== scanToken.current) return;
        if (e instanceof ScanError) setError(e.code);
        else setError("scan-failed" as ErrorCode);
        flow.go("start");
      });
  };

  // Auto-scan on wallet connect — "что бы там подключал кошелек человек и тогда происходила магия"
  const autoScannedAddress = useRef<string | null>(null);
  useEffect(() => {
    if (account?.address && mode !== "demo" && mode !== "readonly") {
      if (autoScannedAddress.current !== account.address && (flow.screen === "start" || !scan)) {
        autoScannedAddress.current = account.address;
        startReal();
      }
    }
    if (!account?.address) {
      autoScannedAddress.current = null;
    }
  }, [account?.address, flow.screen, scan, mode]);

  const resetApp = () => {
    ++scanToken.current;
    if (demoTimer.current !== null) {
      window.clearTimeout(demoTimer.current);
      demoTimer.current = null;
    }
    flow.reset();
    setScan(null);
    setMode(null);
    setScannedAddress(null);
    setPlan(null);
    setCleaned(false);
    setShowMismatch(false);
    setTxResult(null);
    setNavCategory("all");
    setSignPhase("ready");
  };

  /** main CTA — re-run the current scan, or drop to the start screen */
  const handleScan = () => {
    if (mode === "demo") return startDemo();
    if (mode === "readonly" && scannedAddress) return startReadonly(scannedAddress);
    if (account) return startReal();
    flow.go("start");
    setFocusInput(true);
  };

  // ---------- address matching ----------
  const readOnlyMatch =
    mode === "readonly" &&
    !!account &&
    !!scannedAddress &&
    normalizeAddress(account.address) === normalizeAddress(scannedAddress);

  const cleanupAvailable = mode === "demo" || mode === "onchain" || readOnlyMatch;
  const isReadOnly = mode === "readonly" && !cleanupAvailable;
  const mismatch =
    mode === "readonly" &&
    !!account &&
    !!scannedAddress &&
    normalizeAddress(account.address) !== normalizeAddress(scannedAddress);

  // ---------- treasury (fail-safe) ----------
  const treasury = treasuryDisplay();
  const treasuryMissing = !treasury.configured && mode === "onchain";

  // ---------- fee plan (built + simulated in real mode) ----------
  // The plan is ALWAYS derived from the current selection + current scan and
  // is invalidated the moment either of them changes, so the user can never
  // sign a transaction built for a different (earlier) selection. Objects are
  // revalidated live against the chain by planCleanup before the signing gate.
  useEffect(() => {
    if (flow.screen !== "cleanup" && flow.screen !== "final") return;
    const selected = objects.filter((o) => flow.selected.has(o.objectId));
    if (selected.length === 0) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    // Invalidate the previous plan first — the signing gate stays closed
    // until the plan for the CURRENT selection is fully simulated.
    setPlan(null);
    setPlanError(null);
    const demoMode = mode !== "onchain";
    planCleanup(selected, {
      demo: demoMode,
      client: demoMode ? undefined : client,
      sender: demoMode ? undefined : (account?.address ?? undefined),
    })
      .then((p) => {
        if (!cancelled) {
          setPlan(p);
          setPlanError(null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setPlanError(msg);
        if (msg.includes("TREASURY_MISCONFIGURED")) setError("treasury-misconfigured");
        else if (msg.includes("not enough gas") || msg.includes("InsufficientGas")) setError("insufficient-sui");
        else if (msg.includes("dry-run") || msg.includes("simulate") || msg.includes("simulation")) {
          setError("simulation-failed");
        } else setError("cleanup-unavailable");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.screen, mode, objects, selectionKey]);



  /** gate: cleanup stays locked in read-only mode */
  const goCleanup = () => {
    if (isReadOnly) {
      flow.go("readonly");
      return;
    }
    flow.go("cleanup");
  };

  /** bulk-select every object eligible for cleanup (never review/suspicious) */
  const selectAllCleanableTargets = useCallback(() => {
    const ids = selectableTargets.map((o) => o.objectId);
    if (ids.length === 0) return;
    flow.selectMany(ids);
    if (flow.screen !== "explore") flow.go("explore");
  }, [selectableTargets, flow]);

  const reviewDecide = (id: string, inCleanup: boolean) => flow.reviewDecide(id, inCleanup);

  const removeFromCleanup = (id: string) => flow.reviewDecide(id, false);

  // ---------- real signing + execution ----------
  const [signingState, setSigningState] = useState<"idle" | "signing" | "verifying">("idle");
  const [signPhase, setSignPhase] = useState<"ready" | "waiting">("ready");
  const [cleanupGateDetail, setCleanupGateDetail] = useState<string | null>(null);
  /** structured pre-sign validation failures — drives the blocker panel */
  const [signBlockers, setSignBlockers] = useState<SignBlocker[]>([]);
  const walletTimeoutRef = useRef<number | null>(null);
  const walletCancelledRef = useRef(false);

  /** Phase 1: move to READY TO SIGN screen */
  const goToReadyToSign = useCallback(() => {
    const validSelected = new Set(
      [...flow.selected].filter(id => objects.some(o => o.objectId === id))
    );
    if (validSelected.size !== flow.selected.size) {
      flow.clearSelection();
      flow.selectMany([...validSelected]);
      console.log("Removed stale selections");
    }
    setSignPhase("ready");
    setSignBlockers([]);
    setCleanupGateDetail(null);
    flow.go("sign");
  }, [flow, objects]);

  /** Phase 2: open wallet — called by OPEN WALLET button */
  const openWallet = useCallback(async () => {
    if (signingState !== "idle") return;
    const validSelected = new Set(
      [...flow.selected].filter(id => objects.some(o => o.objectId === id))
    );
    if (validSelected.size !== flow.selected.size) {
      flow.clearSelection();
      flow.selectMany([...validSelected]);
      console.log("Removed stale selections before sign");
    }

    if (mode === "demo") {
      setCleaned(true);
      setTxResult({
        digest: "0x0000000000000000000000000000000000000000000000000000000000000000",
        requestedIds: objects.filter((o) => flow.selected.has(o.objectId)).map((o) => o.objectId),
        removedIds: objects.filter((o) => flow.selected.has(o.objectId)).map((o) => o.objectId),
        remainingIds: objects.filter((o) => !flow.selected.has(o.objectId)).map((o) => o.objectId),
        unexpectedChanges: [],
        status: "success",
        before: objects.length,
        after: objects.length - flow.selectedCount,
      });
      flow.go("success");
      return;
    }

    // ---- REAL MODE: signing gate (fail closed) ----
    if (!account) {
      setError("wallet-not-connected");
      return;
    }
    // Fail-closed: ANY selected object that failed the pre-sign revalidation
    // blocks the whole transaction. The user must never sign a transaction
    // that silently acts on a subset of what they reviewed.
    const failedSelected =
      plan?.validation?.filter((v) => !v.ok && flow.selected.has(v.objectId)) ?? [];
    if (!plan?.transaction || failedSelected.length > 0) {
      // Surface WHY the selection is not signable — specific objects + reasons
      // (e.g. digest changed on-chain) instead of a generic message. When the
      // validator produced structured changes (field / before / after), show
      // the focused blocker panel; otherwise fall back to the generic bar.
      if (failedSelected.length > 0) {
        setSignBlockers(
          failedSelected.map((v) => ({
            objectId: v.objectId,
            reasons: v.reasons,
            changes: v.changes,
          }))
        );
        setError(null);
        return;
      }
      setSignBlockers([]);
      setCleanupGateDetail(null);
      setError("cleanup-unavailable");
      return;
    }
    if (!treasury.configured) {
      setError("treasury-misconfigured");
      return;
    }
    // network match
    const walletNetwork = account.chains?.some((c) => c.includes(getNetwork())) ?? false;
    if (!walletNetwork) {
      setError("network-mismatch");
      return;
    }
    // simulation must have succeeded (real mode only produces a plan via dry-run)
    if (plan.demo || plan.simulation?.method !== "dry-run") {
      setError("simulation-failed");
      return;
    }

    // Phase 2: open wallet popup
    walletCancelledRef.current = false;
    setCleanupGateDetail(null);
    setSignBlockers([]);
    setSigningState("signing");
    setSignPhase("waiting");
    // A wallet that never answers must not leave the user on WAITING forever.
    if (walletTimeoutRef.current !== null) window.clearTimeout(walletTimeoutRef.current);
    walletTimeoutRef.current = window.setTimeout(() => {
      walletTimeoutRef.current = null;
      if (walletCancelledRef.current) return;
      walletCancelledRef.current = true;
      setSigningState("idle");
      setSignPhase("ready");
      setError("wallet-timeout");
      flow.go("failed");
    }, 90_000);
    try {
      const result = await signTx.mutateAsync({
        transaction: plan.transaction,
        chain: `sui:${getNetwork()}`,
      });
      const digest = typeof result === "object" && "digest" in result ? (result as { digest: string }).digest : undefined;
      if (!digest) throw new Error("No transaction digest returned by the wallet.");
      if (walletCancelledRef.current) return; // user closed the request manually

      setSigningState("verifying");
      await verifyAndRescan(digest, plan);
    } catch (e: unknown) {
      if (walletCancelledRef.current) return;
      setSigningState("idle");
      setSignPhase("ready");
      const msg = e instanceof Error ? e.message : String(e);
      if (/reject|denied|cancelled|cancel/i.test(msg)) {
        flow.go("cancelled");
      } else {
        // No digest was returned — nothing was sent by the wallet. This is
        // NOT an on-chain failure, so the UI must not claim "transaction
        // failed / nothing assumed cleaned" (that wording is reserved for
        // effects.status.status === "failure").
        setError("sign-failed");
        flow.go("failed");
      }
    }
  }, [signingState, mode, account, plan, treasury, objects, flow, client, scannedAddress, signTx]);

  /** user closed the wallet request while waiting — return to final review */
  const cancelWaiting = useCallback(() => {
    walletCancelledRef.current = true;
    if (walletTimeoutRef.current !== null) {
      window.clearTimeout(walletTimeoutRef.current);
      walletTimeoutRef.current = null;
    }
    setSigningState("idle");
    setSignPhase("ready");
    flow.go("final");
  }, [flow]);

  /** post-tx: full verification pipeline via postTxVerifier */
  const verifyAndRescan = async (digest: string, cleanupPlan: CleanupPlan | null) => {
    const requestedIds = cleanupPlan
      ? cleanupPlan.actedOnIds
      : objects.filter((o) => flow.selected.has(o.objectId)).map((o) => o.objectId);
    const before = objects.length;

    let result: VerificationResult;
    try {
      result = await verifyPostTransaction({
        client,
        walletAddress: account!.address,
        digest,
        actedOnIds: requestedIds,
        beforeCount: before,
      });
    } catch (e) {
      // RPC/network failure while verifying — the transaction may well have
      // executed on-chain. NEVER claim "transaction failed / nothing cleaned"
      // here: the verdict is UNKNOWN and the user must re-scan to confirm.
      const msg = e instanceof Error ? e.message : String(e);
      setTxResult({
        digest,
        requestedIds,
        removedIds: [],
        remainingIds: [],
        unexpectedChanges: [],
        status: "verification-failed",
        before,
        after: before,
        effectsStatus: "fetch-failed",
        discrepancies: [`Verification failed: ${msg}`],
      });
      setError("post-tx-verification-failed");
      flow.go("failed");
      return;
    }

    // The CHAIN rejected the transaction → nothing was cleaned.
    if (result.status === "failure") {
      setTxResult({
        digest: result.digest,
        requestedIds,
        removedIds: [],
        remainingIds: [],
        unexpectedChanges: [],
        status: "failure",
        before,
        after: before,
        verification: result,
        effectsStatus: result.effectsStatus,
        discrepancies: result.discrepancies,
      });
      setError("transaction-failed");
      flow.go("failed");
      return;
    }

    // The result could not be verified (block not found / no effects status).
    if (result.status === "verification-failed") {
      setTxResult({
        digest: result.digest,
        requestedIds,
        removedIds: [],
        remainingIds: [],
        unexpectedChanges: [],
        status: "verification-failed",
        before,
        after: before,
        verification: result,
        effectsStatus: result.effectsStatus,
        discrepancies: result.discrepancies,
      });
      setError("post-tx-verification-failed");
      flow.go("failed");
      return;
    }

    // ── Chain SUCCESS: show the ACTUAL on-chain result ────────────────
    // Financials come exclusively from effects.gasUsed + balanceChanges.
    const grossGasSui =
      result.grossGasMist != null ? mistToSui(result.grossGasMist) : undefined;
    const storageRebateSui =
      result.storageRebateMist != null && result.storageRebateMist > 0n
        ? mistToSui(result.storageRebateMist)
        : undefined;
    const feeMist = result.treasuryReceivedMist;
    const netResultMist =
      result.netResultMist ??
      ((result.storageRebateMist ?? 0n) -
        (result.grossGasMist ?? 0n) -
        (feeMist ?? SERVICE_FEE_MIST));
    const netResultSui =
      netResultMist >= 0n
        ? `+${mistToSui(netResultMist)}`
        : `-${mistToSui(-netResultMist)}`;
    setTxResult({
      digest: result.digest,
      requestedIds,
      removedIds: result.deletedIds,
      remainingIds: result.afterObjects.map((o) => o.objectId),
      unexpectedChanges: [...result.unexpectedDeletions, ...result.unexpectedChanges],
      status: result.status === "success" ? "success" : "state-differs",
      before: result.beforeCount,
      after: result.afterCount,
      gasUsedSui:
        result.gasUsedMist != null ? mistToSui(result.gasUsedMist) : undefined,
      storageRebateSui,
      grossGasSui,
      netResultSui,
      verification: result,
      discrepancies: result.discrepancies.length > 0 ? result.discrepancies : undefined,
      treasuryVerified: result.treasuryVerified,
      treasuryReceivedSui:
        result.treasuryReceivedMist != null ? mistToSui(result.treasuryReceivedMist) : undefined,
      effectsStatus: result.effectsStatus,
    });
    flow.go("success");
  };

  /** "Connect this wallet to clean" — from a read-only report */
  const handleConnectToClean = () => {
    if (!account) {
      connect();
      return;
    }
    if (readOnlyMatch) {
      // The wallet owner is connected: bulk-select the objects that are
      // genuinely eligible (never review/suspicious/protected) and show them
      // in the workspace so the user reviews before anything is cleaned.
      selectAllCleanableTargets();
      return;
    }
    setShowMismatch(true);
  };

  const selectedObjects = useMemo(
    () => objects.filter((o) => flow.selected.has(o.objectId)),
    [objects, flow.selected]
  );
  const remainingObjects = useMemo(
    () => objects.filter((o) => !flow.selected.has(o.objectId)),
    [objects, flow.selected]
  );

  // TRUE execution count: the transaction only acts on objects that received
  // a real command. Objects the builder honestly keeps (lone dust coins with
  // no merge partner, unverified burns, swaps without a quote...) are selected
  // but NOT removed — the wallet preview shows exactly these acted-on objects,
  // so the review screens must count them the same way (Stage 9-10: "Clean 2
  // items" vs wallet "remove 1 object" was this mismatch).
  const execCount = useMemo(() => {
    if (plan && plan.actedOnIds.length > 0) return plan.actedOnIds.length;
    return flow.selectedCount;
  }, [plan, flow.selectedCount]);

  // Fee numbers come from ONE source: plan.fee (dry-run in real mode,
  // calculateDemoFee in demo). Before the plan exists the pre-review screens
  // show the exact same constants feeCalculator produces — never ad-hoc
  // literals (0.05 was a stale value that contradicted the 0.015 SUI fee).
  const isReal = mode === "onchain";
  const demoNetworkFee = mistToSui(DEMO_NETWORK_FEE_MIST); // 0.00142
  const demoCleanerFee = SERVICE_FEE_SUI_DISPLAY; // 0.015
  const demoTotalFee = mistToSui(DEMO_NETWORK_FEE_MIST + SERVICE_FEE_MIST); // 0.01642
  // Demo estimate of the storage rebate on the current selection — mirrors
  // the queue math so the review screens and the Cleanup Plan agree.
  const demoSelectionRebateNum = useMemo(() => {
    if (isReal) return 0;
    return selectedObjects.reduce((acc, o) => acc + storageRebateSui(o), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReal, objects, flow.selected]);
  // ONE financial truth — NET RESULT = storage rebate − network gas − cleaner fee.
  // Pre-execution everything is an ESTIMATE; "you receive" is only shown after
  // a confirmed transaction (Success screen) using actual on-chain values.
  const feeNumbers = useMemo(() => {
    const rebateMist = plan?.gasBreakdown ? plan.gasBreakdown.storageRebate : 0n;
    // gross network gas = computation + storage (before rebate offsets it)
    const grossGasMist = plan?.gasBreakdown
      ? plan.gasBreakdown.computationCost + plan.gasBreakdown.storageCost
      : 0n;
    const cleanerMist = plan?.fee ? plan.fee.cleanerFeeMist : SERVICE_FEE_MIST;
    const demoRebateMist = isReal ? 0n : BigInt(Math.round(demoSelectionRebateNum * 1e9));
    const demoGasMist = isReal ? 0n : DEMO_NETWORK_FEE_MIST;
    const usePlan = !!plan?.gasBreakdown;
    const rebate = usePlan ? rebateMist : demoRebateMist;
    const grossGas = usePlan ? grossGasMist : demoGasMist;
    const netResultMist = rebate - grossGas - cleanerMist;
    const signed = (mist: bigint) =>
      mist >= 0n ? `+${mistToSui(mist)}` : `-${mistToSui(-mist)}`;
    return {
      storageRebateSui: rebate > 0n ? mistToSui(rebate) : undefined,
      networkGasSui: mistToSui(grossGas),
      cleanerFeeSui: mistToSui(cleanerMist),
      netResultSui: signed(netResultMist),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, isReal, demoSelectionRebateNum]);
  const fees = {
    networkFeeSui: plan?.fee.networkFeeSui ?? (isReal ? null : demoNetworkFee),
    cleanerFeeSui: plan?.fee.cleanerFeeSui ?? (isReal ? null : demoCleanerFee),
    totalSui: plan?.fee.totalSui ?? (isReal ? null : demoTotalFee),
    storageRebateSui: plan?.gasBreakdown
      ? mistToSui(plan.gasBreakdown.storageRebate)
      : feeNumbers.storageRebateSui,
    networkGasSui: feeNumbers.networkGasSui,
    netResultSui: feeNumbers.netResultSui,
    computationCostSui: plan?.gasBreakdown
      ? mistToSui(plan.gasBreakdown.computationCost)
      : undefined,
    storageCostSui: plan?.gasBreakdown
      ? mistToSui(plan.gasBreakdown.storageCost)
      : undefined,
    netTotalSui: plan?.fee.netCostMist != null
      ? mistToSui(plan.fee.netCostMist > 0n ? plan.fee.netCostMist : 0n)
      : undefined,
  };

  const showMismatchBanner = mismatch && showMismatch && (flow.screen === "report" || flow.screen === "review" || flow.screen === "readonly" || flow.screen === "explore");

  const treasuryForUi = treasury.address ?? "Not configured";

  const showQueue = !NAV_GHOSTED.has(flow.screen) && flow.screen !== "start";

  // ---------- center content: switches per flow state, same workspace ----------
  let center: ReactNode = null;
  switch (flow.screen) {
    case "start":
      center = (
        <CleanerDesk
          objects={[]}
          selection={flow.selected}
          onSelectObject={(id, select) => flow.reviewDecide(id, select)}
          onSelectGroup={(ids, select) => {
            if (select) flow.selectMany(ids);
            else flow.deselectMany(ids);
          }}
          onClearSelection={flow.clearSelection}
          readonly={true}
          onConnectToClean={connect}
          onReviewCleanup={goCleanup}
          aiKey={aiKey}
          onOpenAI={openAIAssistant}
        />
      );
      break;

    case "analyzing":
      center = (
        <AnalyzingScreen
          label={mode === "demo" ? "Analyzing demo wallet…" : mode === "readonly" ? "Reading wallet" : undefined}
          objects={objects}
          onComplete={() => flow.go("report")}
        />
      );
      break;

    case "report":
    case "explore":
      center = navCategory === "portfolio" ? (
        <div className="ws-screen-center">
          <PortfolioPanel address={scannedAddress} />
        </div>
      ) : (
        <CleanerDesk
          objects={cleaned ? remainingObjects : objects}
          selection={flow.selected}
          onSelectObject={(id, select) => flow.reviewDecide(id, select)}
          onSelectGroup={(ids, select) => {
            if (select) flow.selectMany(ids);
            else flow.deselectMany(ids);
          }}
          onClearSelection={flow.clearSelection}
          readonly={isReadOnly}
          onConnectToClean={handleConnectToClean}
          onReviewCleanup={goCleanup}
          address={scannedAddress ?? undefined}
          aiKey={aiKey}
          onOpenAI={openAIAssistant}
        />
      );
      break;

    case "readonly":
      center = (
        <div className="ws-screen-center">
          <ReadOnlyScreen
            onConnect={handleConnectToClean}
            onKeepExploring={() => flow.go("report")}
          />
        </div>
      );
      break;

    case "cleanup":
      center = (
        <div className="ws-screen-center">
          <CleanupScreen
            items={selectedObjects}
            totalObjects={cleaned ? selectedObjects.length : objects.length}
            fees={fees}
            demo={mode !== "onchain"}
            onRemove={removeFromCleanup}
            onRemoveGroup={(ids) => flow.deselectMany(ids)}
            onReviewTransaction={() => flow.go("final")}
            onBack={() => flow.go("explore")}
          />
        </div>
      );
      break;

    case "final":
      center = (
        <div className="ws-screen-center">
          <FinalReviewScreen
            removeCount={execCount}
            keepCount={objects.length - execCount}
            totalObjects={objects.length}
            selectedCount={flow.selectedCount}
            fees={fees}
            treasury={treasuryForUi}
            demo={mode !== "onchain"}
            simulationVerified={!!plan && !plan.demo && plan.simulation?.method === "dry-run"}
            simulationError={planError}
            treasuryMissing={treasuryMissing}
            pipelineCommands={plan?.preview.commands}
            onConfirm={goToReadyToSign}
            onBack={() => flow.go("cleanup")}
          />
        </div>
      );
      break;

    case "sign":
      center = (
        <div className="ws-screen-center">
          <SignScreen
            phase={signPhase}
            removeCount={execCount}
            keepCount={objects.length - execCount}
            networkFeeSui={fees.networkFeeSui}
            cleanerFeeSui={fees.cleanerFeeSui}
            storageRebateSui={fees.storageRebateSui}
            networkGasSui={fees.networkGasSui}
            netResultSui={fees.netResultSui}
            treasury={treasury.address ?? "Not configured"}
            demo={mode !== "onchain"}
            blockers={signBlockers.length > 0 ? signBlockers : undefined}
            onOpenWallet={openWallet}
            onBack={signPhase === "ready" ? () => flow.go("final") : undefined}
            onCancel={signPhase === "waiting" ? cancelWaiting : undefined}
            onBlockerBack={() => flow.go("cleanup")}
            onBlockerRescan={handleScan}
          />
        </div>
      );
      break;

    case "cancelled":
      center = (
        <div className="ws-screen-center">
          <div className="sign-screen" data-result="cancelled">
            <h2 className="report-title">
              Transaction <span className="highlight">cancelled.</span>
            </h2>
            <p className="final-sub">Nothing was changed. Your wallet is untouched.</p>
            <div className="sign-actions">
              <button className="btn btn-primary" data-act="retry" onClick={() => flow.go("final")}>
                Try again
              </button>
              <button className="btn btn-secondary" data-act="back-to-review" onClick={() => flow.go("cleanup")}>
                Back to cleanup
              </button>
            </div>
          </div>
        </div>
      );
      break;

    case "failed":
      center = (() => {
        // Outcome-specific copy. "Transaction failed / nothing assumed to be
        // cleaned" appears ONLY when the chain itself reported failure
        // (effects.status.status === "failure"). An RPC/network error while
        // verifying is UNKNOWN — the transaction may have executed, so the UI
        // never claims it failed and never claims nothing was cleaned.
        const outcome = txResult?.status;
        if (outcome === "failure") {
          return (
            <div className="ws-screen-center">
              <div className="sign-screen" data-result="failed">
                <h2 className="report-title">
                  Transaction <span className="highlight">failed on-chain.</span>
                </h2>
                <p className="final-sub">
                  Nothing is assumed to be cleaned. The chain rejected this transaction.
                </p>
                <div className="sign-actions">
                  <button className="btn btn-primary" data-act="rescan-wallet" onClick={mode === "demo" ? startDemo : resetApp}>
                    Re-scan wallet
                  </button>
                  <button className="btn btn-secondary" data-act="back-to-review" onClick={() => flow.go("cleanup")}>
                    Back to cleanup
                  </button>
                </div>
              </div>
            </div>
          );
        }
        if (outcome === "verification-failed") {
          return (
            <div className="ws-screen-center">
              <div className="sign-screen" data-result="failed">
                <h2 className="report-title">
                  Result <span className="highlight">could not be verified.</span>
                </h2>
                <p className="final-sub">
                  The transaction was submitted, but its on-chain result could not be
                  confirmed (RPC/network error). It may have executed — re-scan your
                  wallet or view the transaction on the explorer.
                </p>
                {txResult?.digest && (
                  <a
                    href={suiscanTxUrl(getNetwork(), txResult.digest)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    data-act="view-transaction"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    View transaction on SuiScan →
                  </a>
                )}
                <div className="sign-actions">
                  <button className="btn btn-primary" data-act="rescan-wallet" onClick={mode === "demo" ? startDemo : resetApp}>
                    Re-scan wallet
                  </button>
                  <button className="btn btn-secondary" data-act="back-to-review" onClick={() => flow.go("cleanup")}>
                    Back to cleanup
                  </button>
                </div>
              </div>
            </div>
          );
        }
        // No digest yet (signing error / wallet timeout) — nothing was sent.
        return (
          <div className="ws-screen-center">
            <div className="sign-screen" data-result="failed">
              <h2 className="report-title">
                Transaction <span className="highlight">not sent.</span>
              </h2>
              <p className="final-sub">
                No transaction was sent. Your wallet was not changed.
              </p>
              <div className="sign-actions">
                <button className="btn btn-primary" data-act="retry" onClick={() => flow.go("final")}>
                  Try again
                </button>
                <button className="btn btn-secondary" data-act="back-to-review" onClick={() => flow.go("cleanup")}>
                  Back to cleanup
                </button>
              </div>
            </div>
          </div>
        );
      })();
      break;

    case "success":
      center = txResult ? (
        <div className="ws-screen-center">
          <SuccessScreen
            before={txResult.before}
            after={txResult.after}
            removed={txResult.removedIds.length}
            selectedCount={txResult.requestedIds.length}
            digest={txResult.digest}
            status={txResult.status}
            discrepancies={txResult.discrepancies}
            gasUsedSui={txResult.gasUsedSui}
            storageRebateSui={txResult.storageRebateSui}
            grossGasSui={txResult.grossGasSui}
            netResultSui={txResult.netResultSui}
            treasuryVerified={txResult.treasuryVerified}
            treasuryReceivedSui={txResult.treasuryReceivedSui}
            onExplore={() => flow.go("report")}
            onScanAgain={mode === "demo" ? startDemo : resetApp}
          />
        </div>
      ) : null;
      break;
  }

  return (
    <div className="app-page" data-page="app">
      <AppTopBar
        account={account}
        mode={mode}
        onScan={handleScan}
        onConnect={connect}
        onDisconnect={() => disconnect()}
        aiKey={aiKey}
        onToggleAI={() => {
          if (aiKey.isConfigured) {
            setAiFocusObject(null);
            setShowAIAssistant(true);
          } else {
            setShowAISetup(true);
          }
        }}
      />

      {/* AI Setup panel — slide-down overlay */}
      {showAISetup && (
        <div className="ai-setup-overlay">
          <div className="ai-setup-panel">
            <AISetup aiKey={aiKey} onClose={() => setShowAISetup(false)} />
          </div>
        </div>
      )}

      {/* AI Assistant panel (legacy) */}
      {showAIAssistant && (
        <AIAssistant
          aiKey={aiKey}
          objects={objects}
          focusObject={aiFocusObject}
          onClose={() => { setShowAIAssistant(false); setAiFocusObject(null); }}
          onSelectForCleanup={(id) => { flow.reviewDecide(id, true); setShowAIAssistant(false); setAiFocusObject(null); }}
          onKeep={(id) => { flow.reviewDecide(id, false); setShowAIAssistant(false); setAiFocusObject(null); }}
          // AI-driven pre-selection into the EXISTING review flow: the user
          // still reviews, confirms and signs exactly as without AI.
          onSelectMany={(ids) => flow.selectMany(ids)}
          onOpenSettings={() => { setShowAIAssistant(false); setShowAISetup(true); }}
        />
      )}

      <div className={`ws-workspace ${showQueue ? "has-queue" : ""}`}>
        <div className="ws-main-col" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {(flow.screen === "report" || flow.screen === "explore" || flow.screen === "start") && (
            <VaultBanner
              address={scannedAddress || account?.address || null}
              objects={objects}
              cleanableCount={cleanableCount}
              totalRebateSui={totalRebateSui}
              onQuickClean={handleQuickClean}
              // REVIEW & CLEAN never silently selects everything: it opens the
              // review of exactly what the user chose (0 objects = honest empty
              // review, not a surprise bulk selection).
              onReviewClean={goCleanup}
              hasSelection={flow.selected.size > 0}
              onConnect={connect}
              onDemo={startDemo}
              onScanAddress={startReadonly}
            />
          )}

          <div className="ws-center-area" style={{ position: "relative" }}>
            {showMismatchBanner && scannedAddress && account && (
              <AddressMismatch
                scanned={scannedAddress}
                connected={account.address}
                onAnalyzeConnected={startReal}
                onKeepViewing={() => setShowMismatch(false)}
              />
            )}
            {center}
          </div>

          {/* Trust Banner sits inside main column directly beneath content */}
          {(flow.screen === "report" || flow.screen === "explore" || flow.screen === "start") && (
            <div className="ws-trust-banner-wrap">
              <TrustBanner />
            </div>
          )}
        </div>

        {/* Right panel: cleanup queue — visible only if needed */}
        {showQueue && (
          <QueuePanel
            objects={objects}
            selection={flow.selected}
            onClear={flow.clearSelection}
            onRemoveItem={(id) => flow.reviewDecide(id, false)}
            onRemoveGroup={(ids) => flow.deselectMany(ids)}
            onReviewCleanup={goCleanup}
            readonly={isReadOnly}
            fees={{ networkFeeSui: fees.networkFeeSui, cleanerFeeSui: fees.cleanerFeeSui }}
            flightTargetRef={queueRef}
          />
        )}
      </div>

      {error && (
        <ErrorNotice
          code={error}
          detail={cleanupGateDetail ?? undefined}
          onDismiss={() => {
            setError(null);
            setCleanupGateDetail(null);
          }}
        />
      )}

    </div>
  );
}
