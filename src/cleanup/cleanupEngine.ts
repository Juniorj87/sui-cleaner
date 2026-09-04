import type { WalletObject } from "../scanner/objectClassifier";
import { validateObjectsForCleanup, type ValidationResult } from "./cleanupValidator";
import { buildCleanupPTB } from "./transactionBuilder";
import { estimateGas } from "../fees/gasEstimator";
import { calculateFee, calculateDemoFee, type FeeBreakdown } from "../fees/feeCalculator";
import { SERVICE_FEE_MIST, SERVICE_FEE_SUI_DISPLAY } from "../fees/serviceFeeConfig";
import { isTreasuryConfigured, getServiceFeeAddress } from "../fees/treasury";
import { verifyFeeTransferInPTB, FEE_TRANSFER_MISSING } from "./ptbVerifier";
import { selectGasCoin, logGasSelection } from "./gasSelector";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";

export interface CleanupPlan {
  objects: WalletObject[];
  validation: ValidationResult[];
  validObjects: WalletObject[];
  fee: FeeBreakdown;
  preview: { commands: string[]; note: string };
  demo: boolean;
  /** real mode: the final, simulated transaction (undefined in demo) */
  transaction?: Transaction;
  /** real mode: the fee amount used inside the transaction, in MIST */
  feeMist?: bigint;
  /** real mode: simulation summary */
  simulation?: { method: "dry-run"; iterations: number; converged: boolean; digest?: string };
  /** real mode: dry-run gas breakdown (computation / storage / rebate) */
  gasBreakdown?: { computationCost: bigint; storageCost: bigint; storageRebate: bigint };
  /** object ids that actually received a command in the transaction */
  actedOnIds: string[];
}

/**
 * End-to-end cleanup plan, executed in the safety order from the spec:
 *
 *   1. live validation (existence / ownership / digest / type / protected / capability)
 *   2. build PTB with the FIXED service fee (not derived from gas)
 *   3. dry-run to estimate network gas
 *   4. verify fee transfer is present in the final PTB bytes (fail-closed)
 *   5. return the simulated transaction for the signing gate
 *
 * The service fee is a flat, independent amount — no convergence loop needed.
 */
export async function planCleanup(
  objects: WalletObject[],
  opts: {
    demo: boolean;
    client?: SuiJsonRpcClient;
    sender?: string;
  }
): Promise<CleanupPlan> {
  const validation = await validateObjectsForCleanup(objects, { demo: opts.demo, client: opts.client, sender: opts.sender });
  const validObjects = objects.filter((_, i) => validation[i].ok);

  // treasury fail-safe (real mode): no valid treasury -> no cleanup
  if (!opts.demo && !isTreasuryConfigured()) {
    throw new Error("TREASURY_MISCONFIGURED: no service fee address configured.");
  }
  const treasury = opts.demo ? undefined : (getServiceFeeAddress() ?? undefined);

  if (opts.demo) {
    const built = await buildCleanupPTB(validObjects, {
      demo: true,
      serviceFeeRecipient: treasury,
      serviceFeeMist: SERVICE_FEE_MIST,
    });
    const fee = calculateDemoFee();
    return {
      objects,
      validation,
      validObjects,
      fee,
      preview: built.preview,
      demo: true,
      actedOnIds: built.actedOnIds,
    };
  }

  // ---- REAL MODE -----------------------------------------------------------
  if (!opts.client || !opts.sender) {
    throw new Error("Real cleanup requires a client and sender.");
  }

  // 0b. PRE-VALIDATION: Check total SUI balance before building.
  //     Prevents wasting time on PTB construction when user clearly lacks funds.
  const MINIMUM_BALANCE = SERVICE_FEE_MIST + 10_000_000n; // service fee + 0.01 SUI gas reserve
  try {
    const balanceCheck = await opts.client.getBalance({ owner: opts.sender, coinType: "0x2::sui::SUI" });
    const totalBalance = BigInt(balanceCheck.totalBalance);
    if (totalBalance < MINIMUM_BALANCE) {
      throw new Error(
        "Insufficient SUI balance. Available: " + (Number(totalBalance) / 1e9).toFixed(9) +
        " SUI, Required: " + (Number(MINIMUM_BALANCE) / 1e9).toFixed(9) +
        " SUI (" + SERVICE_FEE_SUI_DISPLAY + " SUI service fee + network gas)."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Insufficient SUI balance")) throw e;
    // Balance check failure is non-fatal — gas selection will catch it later
  }

  // 0. Select a dedicated gas coin that is NOT a cleanup target.
  //    This prevents InsufficientCoinBalance errors when the SDK's auto-selected
  //    gas coin conflicts with coins used in cleanup operations.
  const cleanupObjectIds = new Set(validObjects.map((o) => o.objectId));
  const gasSelection = await selectGasCoin(opts.client, opts.sender, cleanupObjectIds);
  logGasSelection(gasSelection);
  const gasCoin = gasSelection.gasCoin;

  // ── PRODUCTION LOG: Full coin listing ─────────────────────────────────
  console.log("\n=== PREPARING CLEANUP TRANSACTION ===");
  console.log("User:", opts.sender);
  console.log("Treasury:", treasury);
  console.log("Service Fee:", SERVICE_FEE_MIST.toString(), "MIST (" + SERVICE_FEE_SUI_DISPLAY + " SUI)");
  console.log("\nUser SUI coins:", gasSelection.allCoins.length);
  for (const c of gasSelection.allCoins) {
    const inCleanup = cleanupObjectIds.has(c.objectId) ? " [CLEANUP TARGET]" : "";
    console.log("  " + c.objectId.slice(0, 16) + "... " + c.balance.toString() + " MIST (" + (Number(c.balance) / 1e9).toFixed(9) + " SUI)" + inCleanup);
  }
  console.log("\nCleanup objects:", cleanupObjectIds.size);
  console.log("Gas coin:", gasCoin ? gasCoin.objectId.slice(0, 16) + "..." : "SDK auto-select");
  console.log("Gas coin balance:", gasCoin ? gasCoin.balance.toString() + " MIST (" + (Number(gasCoin.balance) / 1e9).toFixed(9) + " SUI)" : "unknown");
  console.log("Gas coin IN cleanup:", gasCoin && cleanupObjectIds.has(gasCoin.objectId) ? "YES (ERROR!)" : "NO (OK)");

  // 1. Build PTB with the FIXED service fee (independent of gas)
  const built = await buildCleanupPTB(validObjects, {
    demo: false,
    serviceFeeRecipient: treasury,
    serviceFeeMist: SERVICE_FEE_MIST,
    sender: opts.sender,
    gasCoin,
    mergeCoins: gasSelection.mergeCoins,
  });
  const tx = built.transaction;
  if (!tx) throw new Error("Failed to build the cleanup transaction.");
  tx.setSenderIfNotSet(opts.sender);

  // ── PRODUCTION LOG: PTB commands ──────────────────────────────────────
  const txData = tx.getData();
  console.log("\nPTB COMMANDS:", txData.commands.length);
  for (let idx = 0; idx < txData.commands.length; idx++) {
    const cmd = txData.commands[idx];
    // TransactionKind is an enum — extract kind name safely
    const cmdStr = JSON.stringify(cmd).substring(0, 200);
    const kind = (cmd && typeof cmd === "object" && "kind" in cmd) ? String((cmd as any).kind) : "unknown";
    const target = (cmd && typeof cmd === "object" && "target" in cmd) ? String((cmd as any).target) : "";
    console.log("  [" + idx + "] " + kind + (target ? " -> " + target : "") + " | " + cmdStr);
  }
  console.log("PTB gas payment:", JSON.stringify(txData.gasData.payment));
  console.log("PTB gas budget:", txData.gasData.budget, "MIST");

  // 2. Dry-run to estimate network gas
  console.log("\nRunning dry-run...");
  let gas;
  try {
    gas = await estimateGas(opts.client, tx, opts.sender, { demo: false });
    console.log("DRY-RUN SUCCESS");
    if (gas.breakdown) {
      console.log("  Computation cost:", gas.breakdown.computationCost.toString(), "MIST");
      console.log("  Storage cost:", gas.breakdown.storageCost.toString(), "MIST");
      console.log("  Storage rebate:", gas.breakdown.storageRebate.toString(), "MIST");
      console.log("  Net gas:", gas.mist.toString(), "MIST (" + gas.sui + " SUI)");
    }
    // Show gas balance after
    if (gasCoin) {
      const afterBalance = gasCoin.balance - gas.mist - SERVICE_FEE_MIST;
      console.log("  Gas coin balance after:", afterBalance.toString(), "MIST (" + (Number(afterBalance) / 1e9).toFixed(9) + " SUI)");
    }
  } catch (dryErr) {
    const dryMsg = dryErr instanceof Error ? dryErr.message : String(dryErr);
    console.error("DRY-RUN FAILED:", dryMsg);
    console.error("  Gas coin:", gasCoin ? gasCoin.objectId.slice(0, 16) + "..." : "SDK auto-select");
    console.error("  Gas coin balance:", gasCoin ? gasCoin.balance.toString() + " MIST" : "unknown");
    console.error("  Cleanup targets:", cleanupObjectIds.size);
    console.error("  Gas coin in cleanup:", gasCoin && cleanupObjectIds.has(gasCoin.objectId) ? "YES" : "NO");
    // Debug command 1 if InsufficientCoinBalance
    if (dryMsg.includes("InsufficientCoinBalance")) {
      const txd = tx.getData();
      console.error("\nINSUFFICIENT COIN BALANCE — Command analysis:");
      for (let idx = 0; idx < txd.commands.length; idx++) {
        const cmd = txd.commands[idx] as any;
        const kind = cmd && typeof cmd === "object" && "kind" in cmd ? String(cmd.kind) : "unknown";
        const target = cmd && typeof cmd === "object" && "target" in cmd ? String(cmd.target) : "";
        console.error("  [" + idx + "] " + kind + (target ? " -> " + target : ""));
        console.error("      data:", JSON.stringify(cmd).substring(0, 300));
      }
      console.error("Gas payment:", txd.gasData.payment?.map((p: any) => p.objectId.slice(0, 16) + "...").join(", ") || "auto");
      console.error("Gas budget:", txd.gasData.budget, "MIST");
    }
    throw dryErr;
  }

  // 3. Calculate fee breakdown: flat service fee + estimated network gas
  const storageRebate = gas.breakdown?.storageRebate ?? 0n;
  const fee = calculateFee(gas.mist, { demo: false, storageRebateMist: storageRebate });

  // 4. CRITICAL: Verify fee transfer is present in the final PTB bytes
  //    This prevents signing a transaction that somehow lost the fee transfer.
  //    Reuse the exact bytes from the dry-run build to avoid double-build issues.
  const txBytes = gas.builtBytes ?? await tx.build({ client: opts.client });
  const feeVerification = await verifyFeeTransferInPTB(txBytes, treasury!, SERVICE_FEE_MIST);
  if (!feeVerification.present) {
    throw new Error(
      FEE_TRANSFER_MISSING +
      ` — verification failed: ${feeVerification.reason}. ` +
      "The transaction must not be signed without the service fee."
    );
  }

  return {
    objects,
    validation,
    validObjects,
    fee,
    preview: built.preview,
    demo: false,
    transaction: tx,
    feeMist: SERVICE_FEE_MIST,
    simulation: {
      method: "dry-run",
      iterations: 1, // no convergence loop — flat fee
      converged: true,
    },
    gasBreakdown: gas.breakdown,
    actedOnIds: built.actedOnIds,
  };
}
