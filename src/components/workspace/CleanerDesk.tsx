import { useState, useMemo, useCallback } from "react";
import type { WalletObject } from "../../scanner/objectClassifier";
import type { UseAIKeyReturn } from "../../ai/useAIKey";
import WhatCanBeCleaned from "./WhatCanBeCleaned";
import WalletObjectsTable, { type ObjectFilter } from "./WalletObjectsTable";
import InlineDossier from "./InlineDossier";

interface CleanerDeskProps {
  objects: WalletObject[];
  selection: Set<string>;
  onSelectObject: (id: string, select: boolean, el?: HTMLElement) => void;
  onSelectGroup: (ids: string[], select: boolean, el?: HTMLElement) => void;
  onClearSelection: () => void;
  readonly?: boolean;
  onConnectToClean?: () => void;
  onReviewCleanup?: () => void;
  address?: string;
  aiKey?: UseAIKeyReturn;
  onOpenAI?: (obj?: WalletObject) => void;
}

export default function CleanerDesk({
  objects,
  selection,
  onSelectObject,
  onSelectGroup,
  onClearSelection,
  readonly,
  aiKey,
  onOpenAI,
  address,
  onConnectToClean,
  onReviewCleanup,
}: CleanerDeskProps) {
  const [dossier, setDossier] = useState<WalletObject | null>(null);
  const [tableFilter, setTableFilter] = useState<ObjectFilter>("all");

  // Empty and Dust object lists for category buttons
  const emptyObjects = useMemo(
    () => objects.filter((o) => o.coinBalance === "0" && o.cleanupAction === "delete"),
    [objects]
  );
  const dustObjects = useMemo(
    () => objects.filter((o) => !!o.dust && !o.protected),
    [objects]
  );

  // Handlers for "What can be cleaned?" category cards
  const handleReviewEmpty = useCallback(() => {
    const ids = emptyObjects.map((o) => o.objectId);
    if (ids.length > 0) {
      onSelectGroup(ids, true);
    }
    setTableFilter("cleanable");
  }, [emptyObjects, onSelectGroup]);

  const handleSweepDust = useCallback(() => {
    const ids = dustObjects.map((o) => o.objectId);
    if (ids.length > 0) {
      onSelectGroup(ids, true);
    }
    setTableFilter("cleanable");
  }, [dustObjects, onSelectGroup]);

  const handleReviewSecurity = useCallback(() => {
    setTableFilter("review");
  }, []);

  // If inspecting a specific object, show the detailed InlineDossier
  if (dossier) {
    return (
      <InlineDossier
        object={dossier}
        onBack={() => setDossier(null)}
        allObjects={objects}
        isSelected={selection.has(dossier.objectId)}
        onToggleSelect={(sel) => onSelectObject(dossier.objectId, sel)}
        readonly={readonly}
        aiKey={aiKey}
        onOpenAI={onOpenAI}
      />
    );
  }

  return (
    <div className="cleaner-desk-container" data-testid="cleaner-desk">
      {/* 1. What Can Be Cleaned? Block (Section 4 of ТЗ) */}
      <WhatCanBeCleaned
        objects={objects}
        onReviewEmpty={handleReviewEmpty}
        onSweepDust={handleSweepDust}
        onReviewSecurity={handleReviewSecurity}
      />

      {/* 2. Wallet Objects Compact Table (Section 5 of ТЗ) */}
      <WalletObjectsTable
        objects={objects}
        selection={selection}
        onSelectObject={onSelectObject}
        onSelectGroup={onSelectGroup}
        onClearSelection={() => onClearSelection?.()}
        onInspect={(obj) => setDossier(obj)}
        readonly={readonly}
        onReviewCleanup={onReviewCleanup}
        activeFilter={tableFilter}
        onFilterChange={setTableFilter}
        address={address}
        onConnect={onConnectToClean}
      />
    </div>
  );
}
