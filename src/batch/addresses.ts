/**
 * Batch address intake — parse, validate, dedupe, cap.
 *
 * Sources: pasted text (one address per line; commas/semicolons/whitespace
 * also split) and TXT/CSV uploads (`address` column or `wallet,address,label`
 * header; first column otherwise). Labels are shown as-is or "—".
 *
 * Pure module — every TEST 4/5/6 case runs against these functions.
 */

import { isSuiAddress, normalizeAddress } from "../lib/suiAddress";

/** Hard cap for one batch run — never 1000 in this version. */
export const MAX_BATCH_WALLETS = 100;

export type BatchEntryStatus = "ready" | "invalid" | "duplicate";

export interface BatchEntry {
  /** canonical normalized address (lowercase, 64-hex padded) */
  address: string;
  /** short display form */
  display: string;
  label: string;
  status: BatchEntryStatus;
}

export interface BatchPreview {
  entries: BatchEntry[];
  uploaded: number;
  valid: number;
  invalid: number;
  duplicates: number;
  /** unique valid entries — the actual scan set */
  uniqueValid: number;
  /** true when uniqueValid exceeds the cap: UI must block the run */
  overLimit: boolean;
}

export function shortDisplay(address: string): string {
  const a = address;
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const EMPTY_LABEL = "—";

/**
 * Build the preview from raw items. Order preserved: first occurrence wins,
 * later repeats of the same normalized address are marked duplicate.
 */
export function buildPreview(items: Array<{ address: string; label?: string }>): BatchPreview {
  const entries: BatchEntry[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  let duplicates = 0;

  for (const item of items) {
    const raw = (item.address ?? "").trim();
    if (!raw) continue;
    if (!isSuiAddress(raw)) {
      invalid += 1;
      entries.push({ address: raw, display: shortDisplay(raw), label: item.label?.trim() || EMPTY_LABEL, status: "invalid" });
      continue;
    }
    const norm = normalizeAddress(raw);
    if (seen.has(norm)) {
      duplicates += 1;
      entries.push({ address: norm, display: shortDisplay(norm), label: item.label?.trim() || EMPTY_LABEL, status: "duplicate" });
      continue;
    }
    seen.add(norm);
    entries.push({ address: norm, display: shortDisplay(norm), label: item.label?.trim() || EMPTY_LABEL, status: "ready" });
  }

  const uniqueValid = seen.size;
  return {
    entries,
    uploaded: entries.length,
    valid: uniqueValid + duplicates,
    invalid,
    duplicates,
    uniqueValid,
    overLimit: uniqueValid > MAX_BATCH_WALLETS,
  };
}

/** Remove one entry (by canonical address + status row) and recount. */
export function removePreviewEntry(preview: BatchPreview, address: string, status: BatchEntryStatus): BatchPreview {
  const idx = preview.entries.findIndex((e) => e.address === address && e.status === status);
  if (idx < 0) return preview;
  const rest = preview.entries.filter((_, i) => i !== idx);
  // Rebuild from the survivors so duplicate flags stay consistent
  // (a former duplicate may become ready once its twin is removed).
  return buildPreview(rest.map((e) => ({ address: e.address, label: e.label === EMPTY_LABEL ? undefined : e.label })));
}

/** Split pasted text into raw address items. */
export function parseAddressText(raw: string): Array<{ address: string }> {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((address) => ({ address }));
}

function splitRow(line: string): string[] {
  const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  // Minimal CSV: split on the delimiter, strip surrounding quotes.
  return line.split(delim).map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
}

/**
 * Parse TXT/CSV upload content. Header row detected by wallet/address/label
 * keywords; otherwise the first column is the address and the second (if
 * present) the label.
 */
export function parseCsvText(text: string): Array<{ address: string; label?: string }> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const head = splitRow(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = head.some((c) => ["wallet", "address", "label", "name"].includes(c));
  let addrIdx = 0;
  let labelIdx = -1;
  let start = 0;
  if (hasHeader) {
    addrIdx = head.findIndex((c) => c === "wallet" || c === "address");
    if (addrIdx < 0) addrIdx = 0;
    labelIdx = head.findIndex((c) => c === "label" || c === "name");
    start = 1;
  } else if (splitRow(lines[0]).length > 1) {
    labelIdx = 1;
  }

  const out: Array<{ address: string; label?: string }> = [];
  for (let i = start; i < lines.length; i++) {
    const cols = splitRow(lines[i]);
    const address = (cols[addrIdx] ?? "").trim();
    if (!address) continue;
    const label = labelIdx >= 0 ? (cols[labelIdx] ?? "").trim() || undefined : undefined;
    out.push({ address, label });
  }
  return out;
}
