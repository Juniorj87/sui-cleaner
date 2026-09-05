/**
 * Batch results: aggregate summary, sorting, filtering, CSV export.
 * Pure functions — fully covered by the TEST matrix.
 */

import type { BatchWalletResult } from "./batchScanner";

export interface BatchAggregate {
  wallets: number;
  objects: number;
  safe: number;
  review: number;
  /** summed ESTIMATED rebates of wallets that produced one */
  rebate: number;
  /** wallets whose scan succeeded (estimate available) */
  withEstimate: number;
  failed: number;
}

export function aggregateBatch(results: BatchWalletResult[]): BatchAggregate {
  let objects = 0;
  let safe = 0;
  let review = 0;
  let rebate = 0;
  let withEstimate = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "failed") {
      failed += 1;
      continue;
    }
    // Object counts are exact for every scanned wallet; the rebate total is
    // the sum of wallets WITH a reliable estimate only — never a partial
    // sum presented as the whole batch (see the withEstimate note).
    objects += r.objects;
    safe += r.safe;
    review += r.review;
    if (r.source === "unavailable") continue;
    withEstimate += 1;
    rebate += r.rebate;
  }
  return {
    wallets: results.length,
    objects,
    safe,
    review,
    rebate: Math.round(rebate * 10000) / 10000,
    withEstimate,
    failed,
  };
}

export type BatchSortKey = "wallet" | "objects" | "cleanable" | "rebate";
export type BatchSortDir = "asc" | "desc";

export function sortBatchResults(
  results: BatchWalletResult[],
  key: BatchSortKey,
  dir: BatchSortDir
): BatchWalletResult[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...results].sort((a, b) => {
    switch (key) {
      case "wallet": return a.address.localeCompare(b.address) * mul;
      case "objects": return (a.objects - b.objects) * mul || a.address.localeCompare(b.address);
      case "cleanable": return (a.safe - b.safe) * mul || a.address.localeCompare(b.address);
      case "rebate": return (a.rebate - b.rebate) * mul || a.address.localeCompare(b.address);
    }
  });
}

export type BatchFilter = "all" | "cleanable" | "none" | "failed";

export function filterBatchResults(results: BatchWalletResult[], filter: BatchFilter): BatchWalletResult[] {
  switch (filter) {
    case "cleanable": return results.filter((r) => r.status === "ready" && r.safe > 0);
    case "none": return results.filter((r) => r.status === "ready" && r.safe === 0);
    case "failed": return results.filter((r) => r.status === "failed");
    case "all":
    default: return results;
  }
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Export header + one row per wallet. Public data only: address, label,
 * counts, estimate, status. NEVER keys, seeds, credentials, AI keys.
 */
export function batchToCsv(results: BatchWalletResult[]): string {
  const lines = ["wallet,label,objects,safe_to_clean,review,keep,estimated_rebate,status"];
  for (const r of results) {
    const hasEstimate = r.status === "ready" && r.source !== "unavailable";
    lines.push(
      [
        csvCell(r.address),
        csvCell(r.label),
        r.objects,
        r.safe,
        r.review,
        r.keep,
        hasEstimate ? r.rebate.toFixed(4) : "",
        r.status,
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
