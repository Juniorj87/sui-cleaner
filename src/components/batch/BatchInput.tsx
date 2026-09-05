/**
 * Batch intake: paste addresses or upload TXT/CSV, then PREVIEW.
 * Nothing scans until the user presses SCAN N WALLETS.
 */

import { useRef, useState } from "react";
import {
  MAX_BATCH_WALLETS,
  buildPreview,
  parseAddressText,
  parseCsvText,
} from "../../batch/addresses";
import { isSuiAddress, normalizeAddress } from "../../lib/suiAddress";

export interface BatchDraft {
  text: string;
  upload: Array<{ address: string; label?: string }>;
}

export default function BatchInput({
  draft,
  onDraft,
  onStart,
  onBack,
}: {
  /** preserved draft (survives progress → BACK); reported back on every change */
  draft: BatchDraft;
  onDraft: (draft: BatchDraft) => void;
  onStart: (items: Array<{ address: string; label?: string }>) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setTextState] = useState(draft.text);
  const [uploadItems, setUploadItemsState] = useState(draft.upload);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refs mirror state so draft reports never pair stale halves.
  const textRef = useRef(text);
  const uploadRef = useRef(uploadItems);
  const setText = (next: string) => {
    textRef.current = next;
    setTextState(next);
    onDraft({ text: next, upload: uploadRef.current });
  };
  const setUploadItems = (next: Array<{ address: string; label?: string }>) => {
    uploadRef.current = next;
    setUploadItemsState(next);
    onDraft({ text: textRef.current, upload: next });
  };

  // Preview derives straight from the current source every render —
  // removing a row updates every counter immediately.
  const sourceItems = tab === "paste" ? parseAddressText(text) : uploadItems;
  const shown = buildPreview(sourceItems);

  const pickFile = () => fileRef.current?.click();

  const onFile = async (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (f.size > 512 * 1024) {
      setFileError("File is too large (max 512 KB of addresses).");
      return;
    }
    try {
      const content = await f.text();
      setUploadItems(parseCsvText(content));
      setFileName(f.name);
    } catch {
      setFileError("Could not read that file as text.");
    }
  };

  /** match a preview row back to its raw source item (short forms pad on normalize) */
  const sameSource = (raw: string, needle: string) => {
    const t = raw.trim();
    if (t.toLowerCase() === needle) return true;
    return isSuiAddress(t) && normalizeAddress(t) === needle;
  };

  const removeRow = (address: string) => {
    const needle = address.trim().toLowerCase();
    if (tab === "paste") {
      const items = parseAddressText(text);
      const idx = items.findIndex((it) => sameSource(it.address, needle));
      if (idx < 0) return;
      items.splice(idx, 1);
      setText(items.map((it) => it.address).join("\n"));
    } else {
      const idx = uploadItems.findIndex((it) => sameSource(it.address, needle));
      if (idx < 0) return;
      const next = [...uploadItems];
      next.splice(idx, 1);
      setUploadItems(next);
    }
  };

  const readyItems = shown.entries
    .filter((e) => e.status === "ready")
    .map((e) => ({ address: e.address, label: e.label === "—" ? undefined : e.label }));
  const canStart = readyItems.length > 0 && !shown.overLimit;
  const scanLabel =
    readyItems.length === 1 ? "SCAN 1 WALLET" : `SCAN ${readyItems.length} WALLETS`;

  return (
    <div className="batch-screen" data-batch="input">
      <div className="batch-head">
        <div>
          <h2 className="report-title">Batch scan.</h2>
          <p className="final-sub">Analyze up to {MAX_BATCH_WALLETS} Sui wallets at once. Batch analysis only — cleanup stays individual.</p>
        </div>
        <button className="btn btn-secondary" data-act="back" onClick={onBack}>
          ← BACK
        </button>
      </div>

      <div className="batch-tabs" role="tablist" aria-label="Address input">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "paste"}
          className={`batch-tab ${tab === "paste" ? "active" : ""}`}
          onClick={() => setTab("paste")}
        >
          Paste addresses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "upload"}
          className={`batch-tab ${tab === "upload" ? "active" : ""}`}
          onClick={() => setTab("upload")}
        >
          TXT / CSV upload
        </button>
      </div>

      {tab === "paste" ? (
        <textarea
          className="batch-textarea"
          data-input="batch-addresses"
          placeholder={"0xAAA…\n0xBBB…\n0xCCC…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          aria-label="Wallet addresses, one per line"
        />
      ) : (
        <div className="batch-upload">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,text/plain,text/csv"
            hidden
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button className="btn btn-secondary" data-act="upload" onClick={pickFile}>
            CHOOSE FILE
          </button>
          <span className="final-sub">{fileName ?? "Columns: address — or wallet,address,label"}</span>
          {fileError && <p className="app-home-error">{fileError}</p>}
        </div>
      )}

      <div className="batch-preview" aria-live="polite">
        <div className="batch-preview-title">BATCH SCAN PREVIEW</div>
        <div className="batch-stats">
          <span>Uploaded: <b>{shown.uploaded}</b></span>
          <span>Valid: <b>{shown.valid}</b></span>
          <span>Invalid: <b>{shown.invalid}</b></span>
          <span>Duplicates: <b>{shown.duplicates}</b></span>
          <span>Unique valid: <b>{shown.uniqueValid}</b></span>
        </div>
        {shown.overLimit && (
          <p className="app-home-error" role="alert">
            You can scan up to {MAX_BATCH_WALLETS} wallets at a time. Remove {shown.uniqueValid - MAX_BATCH_WALLETS} address{shown.uniqueValid - MAX_BATCH_WALLETS === 1 ? "" : "es"} to continue — the scan will not start like this.
          </p>
        )}
        {shown.entries.length > 0 && (
          <div className="tbl-container">
            <table className="compact-table">
              <thead>
                <tr><th>#</th><th>WALLET</th><th>LABEL</th><th>STATUS</th><th>ACTION</th></tr>
              </thead>
              <tbody>
                {shown.entries.map((e, i) => (
                  <tr key={`${e.address}-${e.status}-${i}`} className="compact-table-row">
                    <td>{i + 1}</td>
                    <td className="mono">{e.display}</td>
                    <td>{e.label}</td>
                    <td>{e.status === "ready" ? "READY" : e.status === "duplicate" ? "DUPLICATE" : "INVALID"}</td>
                    <td>
                      <button
                        type="button"
                        className="batch-remove-btn"
                        data-act="remove-entry"
                        onClick={() => removeRow(e.address)}
                      >
                        REMOVE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="final-sub">{shown.uniqueValid} wallets ready to scan</p>
      </div>

      <div className="batch-actions">
        <button
          className="btn btn-primary"
          data-act="start-batch"
          disabled={!canStart}
          onClick={() => onStart(readyItems)}
        >
          {scanLabel}
        </button>
      </div>
    </div>
  );
}
