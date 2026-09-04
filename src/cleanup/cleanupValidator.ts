import type { WalletObject } from "../scanner/objectClassifier";
import { normalizeAddress } from "../lib/suiAddress";
import { normalizeTypeRepr } from "../scanner/walletScanner";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

/** a single structured change detected between the scan snapshot and live state */
export interface ValidationChange {
  /** what changed: "existence" | "ownership" | "digest" | "type" */
  field: string;
  /** snapshot value at scan time (undefined when not comparable) */
  before?: string;
  /** live on-chain value at validation time */
  after?: string;
}

export interface ValidationResult {
  ok: boolean;
  objectId: string;
  reasons: string[];
  /** structured before/after detail for each detected change (error UX) */
  changes?: ValidationChange[];
}

/**
 * SAFETY RULE (spec §19): never blindly execute cleanup based on cached scan
 * results. Between scan and transaction the object may have changed, been
 * transferred, consumed, or its ownership may have changed.
 *
 * Demo mode validates against the local demo dataset (all demo objects are
 * stable). Real mode checks LIVE RPC state:
 *   - object still exists
 *   - still owned by the connected wallet (AddressOwner match)
 *   - digest matches the scanned state
 *   - type matches the scanned state
 *   - not protected
 *   - cleanup capability still verified
 *
 * TYPE COMPARISON is canonical: scan types are normalized by
 * normalizeTypeRepr (GraphQL repr arrives padded) and live JSON-RPC types
 * can also arrive padded depending on the provider, so BOTH sides are
 * normalized before comparing — a representation difference is never
 * reported as an on-chain change.
 */
export async function validateForCleanup(
  object: WalletObject,
  deps: { demo: boolean; client?: SuiJsonRpcClient; sender?: string }
): Promise<ValidationResult> {
  const reasons: string[] = [];
  const changes: ValidationChange[] = [];

  // 1. never touch protected objects
  if (object.protected || object.classification === "protected") {
    return { ok: false, objectId: object.objectId, reasons: ["PROTECTED — not included in cleanup."] };
  }

  // 2. cleanup capability must be verified (deterministic, not guessed)
  if (!object.cleanupAction) {
    return {
      ok: false,
      objectId: object.objectId,
      reasons: ["Cleanup capability not verified for this object."],
    };
  }

  if (!deps.demo) {
    if (!deps.client || !deps.sender) {
      return { ok: false, objectId: object.objectId, reasons: ["Live validation unavailable."] };
    }
    try {
      // 3. object still exists
      const live = await deps.client.getObject({
        id: object.objectId,
        options: { showType: true, showOwner: true },
      });
      const data = live.data;
      if (!data) {
        changes.push({
          field: "existence",
          before: "object existed at scan",
          after: "object no longer exists on chain",
        });
        return { ok: false, objectId: object.objectId, reasons: ["Object no longer exists."], changes };
      }

      // 4. still owned by the connected wallet (AddressOwner match)
      const owner = data.owner;
      const addressOwner =
        owner && typeof owner === "object" && "AddressOwner" in owner
          ? String((owner as { AddressOwner: string }).AddressOwner)
          : undefined;
      if (!addressOwner) {
        reasons.push("Object is not address-owned.");
        changes.push({ field: "ownership", before: "address-owned", after: "not address-owned" });
      } else if (normalizeAddress(addressOwner) !== normalizeAddress(deps.sender)) {
        reasons.push("Object ownership changed — it is no longer in your wallet.");
        changes.push({
          field: "ownership",
          before: deps.sender,
          after: addressOwner,
        });
      }

      // 5. digest matches the scanned state (object has not changed)
      if (object.digest && data.digest && data.digest !== object.digest) {
        reasons.push("Object changed since scan — revalidated.");
        changes.push({
          field: "digest",
          before: object.digest,
          after: data.digest,
        });
      }

      // 6. type matches the scanned state — canonical short form on BOTH sides
      const snapshotType = object.type ? normalizeTypeRepr(object.type) : undefined;
      const liveType = data.type ? normalizeTypeRepr(data.type) : undefined;
      if (snapshotType && liveType && liveType !== snapshotType) {
        reasons.push("Object type changed since scan.");
        changes.push({
          field: "type",
          before: snapshotType,
          after: liveType,
        });
      }
    } catch {
      return {
        ok: false,
        objectId: object.objectId,
        reasons: ["Could not verify the object's current state (RPC unavailable)."],
      };
    }
  }

  return { ok: reasons.length === 0, objectId: object.objectId, reasons, changes };
}

/**
 * Validate multiple objects for cleanup in a single batch (multiGetObjects).
 * Eliminates the N+1 RPC queries bottleneck.
 */
export async function validateObjectsForCleanup(
  objects: WalletObject[],
  deps: { demo: boolean; client?: SuiJsonRpcClient; sender?: string }
): Promise<ValidationResult[]> {
  if (deps.demo) {
    return objects.map((o) => {
      if (o.protected || o.classification === "protected") {
        return { ok: false, objectId: o.objectId, reasons: ["PROTECTED — not included in cleanup."] };
      }
      if (!o.cleanupAction) {
        return { ok: false, objectId: o.objectId, reasons: ["Cleanup capability not verified for this object."] };
      }
      return { ok: true, objectId: o.objectId, reasons: [] };
    });
  }

  if (!deps.client || !deps.sender) {
    return objects.map((o) => ({ ok: false, objectId: o.objectId, reasons: ["Live validation unavailable."] }));
  }

  const ids = objects.map((o) => o.objectId);
  try {
    const liveObjects = await deps.client.multiGetObjects({
      ids,
      options: { showType: true, showOwner: true },
    });
    const liveMap = new Map(
      liveObjects
        .filter((lo) => lo.data != null)
        .map((lo) => [lo.data!.objectId, lo.data!])
    );

    return objects.map((o) => {
      const reasons: string[] = [];
      const changes: ValidationChange[] = [];

      // 1. never touch protected objects
      if (o.protected || o.classification === "protected") {
        return { ok: false, objectId: o.objectId, reasons: ["PROTECTED — not included in cleanup."] };
      }

      // 2. cleanup capability must be verified
      if (!o.cleanupAction) {
        return { ok: false, objectId: o.objectId, reasons: ["Cleanup capability not verified for this object."] };
      }

      const data = liveMap.get(o.objectId);
      // 3. object still exists
      if (!data) {
        changes.push({
          field: "existence",
          before: "object existed at scan",
          after: "object no longer exists on chain",
        });
        return { ok: false, objectId: o.objectId, reasons: ["Object no longer exists."], changes };
      }

      // 4. still owned by the connected wallet (AddressOwner match)
      const owner = data.owner;
      const addressOwner =
        owner && typeof owner === "object" && "AddressOwner" in owner
          ? String((owner as { AddressOwner: string }).AddressOwner)
          : undefined;
      if (!addressOwner) {
        reasons.push("Object is not address-owned.");
        changes.push({ field: "ownership", before: "address-owned", after: "not address-owned" });
      } else if (normalizeAddress(addressOwner) !== normalizeAddress(deps.sender!)) {
        reasons.push("Object ownership changed — it is no longer in your wallet.");
        changes.push({
          field: "ownership",
          before: deps.sender,
          after: addressOwner,
        });
      }

      // 5. digest matches the scanned state
      if (o.digest && data.digest && data.digest !== o.digest) {
        reasons.push("Object changed since scan — revalidated.");
        changes.push({
          field: "digest",
          before: o.digest,
          after: data.digest,
        });
      }

      // 6. type matches the scanned state — canonical short form on BOTH sides
      const snapshotType = o.type ? normalizeTypeRepr(o.type) : undefined;
      const liveType = data.type ? normalizeTypeRepr(data.type) : undefined;
      if (snapshotType && liveType && liveType !== snapshotType) {
        reasons.push("Object type changed since scan.");
        changes.push({
          field: "type",
          before: snapshotType,
          after: liveType,
        });
      }

      return { ok: reasons.length === 0, objectId: o.objectId, reasons, changes };
    });
  } catch {
    return objects.map((o) => ({
      ok: false,
      objectId: o.objectId,
      reasons: ["Could not verify the object's current state (RPC unavailable)."],
    }));
  }
}