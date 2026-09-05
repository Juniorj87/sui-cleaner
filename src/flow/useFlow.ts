import { useCallback, useState } from "react";

/**
 * The product journey. Transitions are driven by the app page (the
 * "analyzing" screen never auto-advances — analysis completion decides),
 * so demo and real wallets can move at their own pace.
 */
export type Screen =
  | "start"
  | "home"
  | "analyzing"
  | "report"
  | "explore"
  | "review"
  | "readonly"
  | "cleanup"
  | "final"
  | "sign"
  | "success"
  | "cancelled"
  | "failed"
  | "batch"
  | "batch-progress"
  | "batch-results";

/** user-facing analysis sequence — the investigation, step by step */
export const SCAN_STEPS = [
  "Connecting",
  "Reading your wallet",
  "Identifying items",
  "Checking protocols",
  "Checking what can be removed",
  "Analysis complete",
];

export interface Flow {
  screen: Screen;
  selected: Set<string>;
  /** current position in the review queue (0-based) */
  reviewIndex: number;
  go: (s: Screen) => void;
  /** advance to the next review item */
  reviewNext: () => void;
  /** decide whether the current item is in the cleanup set */
  reviewDecide: (id: string, inCleanup: boolean) => void;
  selectAll: (ids: string[]) => void;
  /** add the given ids to the selection (explore group SELECT ALL) */
  selectMany: (ids: string[]) => void;
  /** remove the given ids from the selection (explore CLEAR / deselect) */
  deselectMany: (ids: string[]) => void;
  /** empty the selection */
  clearSelection: () => void;
  reset: () => void;
  selectedCount: number;
}

export function useFlow(): Flow {
  // The /app landing is the App Home — no scan starts by itself.
  const [screen, setScreen] = useState<Screen>("home");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewIndex, setReviewIndex] = useState(0);

  const go = useCallback((s: Screen) => {
    if (s === "review") setReviewIndex(0);
    setScreen(s);
  }, []);

  const reviewNext = useCallback(() => {
    setReviewIndex((i) => i + 1);
  }, []);

  const reviewDecide = useCallback((id: string, inCleanup: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (inCleanup) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  const selectMany = useCallback((ids: string[]) => {
    setSelected((prev) => {
      if (ids.length === 0) return prev;
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const deselectMany = useCallback((ids: string[]) => {
    setSelected((prev) => {
      if (ids.length === 0) return prev;
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const reset = useCallback(() => {
    setSelected(new Set());
    setReviewIndex(0);
    // Back lands on the App Home — and home never re-scans by itself.
    setScreen("home");
  }, []);

  return {
    screen,
    selected,
    reviewIndex,
    go,
    reviewNext,
    reviewDecide,
    selectAll,
    selectMany,
    deselectMany,
    clearSelection,
    reset,
    selectedCount: selected.size,
  };
}
