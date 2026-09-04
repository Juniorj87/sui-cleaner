/**
 * Grouped wallet view — pure helpers that turn the flat object list into a
 * consumer-readable inventory.
 *
 * The most important distinction the report must make:
 *
 *   ACTIVE ASSET      — a Coin<T> with balance > 0 (you own value)
 *   EMPTY COIN OBJECT — a Coin<T> with balance === 0 (an empty object that
 *                       can be destroyed via coin::destroy_zero — NOT a token
 *                       you own)
 *
 * Sections (grouped default view):
 *   ACTIVE ASSETS · PROTECTED · REVIEW · EMPTY OBJECTS · OTHER CLEANABLE
 *
 * Everything here is derived from the same WalletObject[] the rest of the
 * app uses — no hardcoded counts.
 */

import type { WalletObject } from "../scanner/objectClassifier";
import {
  findProjectByCoinType,
  findProjectByPackage,
  findProjectByCollection,
  findProjectByName,
  projectMark,
  type ProjectIdentity,
} from "../data/projectRegistry";

export type GroupKind = "token" | "nft" | "protocol" | "other";
export type GroupStatus = "keep" | "protected" | "review" | "cleanable";

export const GROUP_STATUS_PRIORITY: GroupStatus[] = ["protected", "cleanable", "review", "keep"];

export interface WalletGroup {
  id: string;
  /** primary label — "USDC", "Pixel Pudgy", "Navi Protocol", "Unknown Token" */
  title: string;
  /** secondary label — "Circle", "Unknown collection", "Navi Protocol" */
  subtitle: string;
  kind: GroupKind;
  /** dominant status (priority: protected > cleanable > review > keep) */
  status: GroupStatus;
  /** how many items fall into each status — shown when mixed */
  statusCounts: { keep: number; protected: number; review: number; cleanable: number };
  count: number;
  /** true when every item is an empty (zero-balance) Coin object */
  isEmptyCoins?: boolean;
  /** coin groups: total balance in base units, when every item reports one */
  coinBalance?: string;
  /** demo value hint (USD) when every item reports a value */
  estValueUsd?: number;
  identity?: ProjectIdentity;
  mark: string;
  items: WalletObject[];
}

/** sections of the grouped default view */
export type SectionKey = "active" | "nft" | "defi" | "protected" | "review" | "empty" | "other-cleanable";

export interface GroupedSection {
  key: SectionKey;
  title: string;
  groups: WalletGroup[];
}

export interface GroupedWallet {
  total: number;
  totals: {
    /** keep items — real assets (coins with balance, valuable NFTs, trusted objects) */
    active: number;
    /** NFT items — all NFT groups (keep, review, cleanable) */
    nft: number;
    /** DeFi / protocol position items */
    defi: number;
    protected: number;
    review: number;
    /** zero-balance Coin objects — empty, removable */
    empty: number;
    /** verified removable items that are NOT empty coins (e.g. catalogued NFT burns) */
    otherCleanable: number;
    /** empty + otherCleanable — everything with a verified cleanup action */
    cleanable: number;
  };
  /** distinct coin types among empty coins — "31 token types" */
  emptyTokenTypes: number;
  sections: GroupedSection[];
}

/* ------------------------------ identity ---------------------------------- */

/** the inner type of a coin: `0x2::coin::Coin<0x…::usdc::USDC>` → `0x…::usdc::USDC` */
export function coinInnerType(type: string): string | null {
  const m = type.match(/^0x2::coin::Coin<(.+)>$/);
  return m ? m[1] : null;
}

/**
 * A Coin<T> object with actual balance === 0 is an EMPTY COIN OBJECT.
 * Only a real zero balance counts — never infer emptiness from a missing
 * market price or missing metadata.
 */
export function isEmptyCoinObject(o: WalletObject): boolean {
  return o.category === "coin" && o.coinBalance === "0";
}

/** A Coin<T> object with balance > 0 is an ACTIVE ASSET (you own value). */
export function isActiveCoin(o: WalletObject): boolean {
  return o.category === "coin" && o.coinBalance != null && o.coinBalance !== "0";
}

/* ---------------------- explicit classification flags --------------------- */

/** recognized identity (project registry) or verified collection/protocol */
export function isKnown(o: WalletObject): boolean {
  return !!resolve(o).identity || o.classification === "keep" || o.classification === "protected";
}

/** identity could not be confidently verified */
export function isUnknown(o: WalletObject): boolean {
  return !isKnown(o) && !o.protected;
}

export function isReview(o: WalletObject): boolean {
  return o.classification === "review";
}

export function isProtected(o: WalletObject): boolean {
  return o.protected || o.classification === "protected";
}

/** verified cleanup action exists (the only path into cleanup) */
export function isCleanable(o: WalletObject): boolean {
  return !!o.cleanupAction && !o.protected;
}

/**
 * Auto-eligible for cleanup: a verified action on an object that is NOT
 * flagged for manual review (review/suspicious must be inspected first) and
 * not protected. This is the set that row checkboxes, the CLEANABLE tab and
 * SELECT ALL CLEANABLE act on — including verified-cleanable NFTs (their
 * removal mechanism is real, they just return no storage rebate).
 */
export function isCleanableTarget(o: WalletObject): boolean {
  if (o.protected || o.classification === "protected") return false;
  if (!o.cleanupAction) return false;
  if (o.classification === "review" || o.classification === "suspicious") return false;
  return true;
}

/**
 * Per-object estimated storage rebate (SUI) for the UI summary cards.
 * Only actions that free storage return a rebate:
 *  - empty (zero-balance) coin → destroy_zero → +0.0028
 *  - dust coin → merge consumes the empty container → ~+0.002
 *  - NFT / object "burn" (transfer to 0x0) → NO storage rebate
 *  - withdraw / recovered value → not a storage rebate
 */
export function storageRebateSui(o: WalletObject): number {
  if (o.coinBalance === "0") return 0.0028;
  if (o.dust) return 0.002;
  return 0;
}

/** human-readable type for a selected item row (Cleanup Plan list) */
export function itemTypeLabel(o: WalletObject): string {
  if (o.coinBalance === "0") return "Empty object";
  if (o.dust) return "Dust token";
  if (o.category === "nft") return "NFT";
  if (o.position || o.cleanupAction === "withdraw") return "Recover";
  return "Object";
}

/** an asset you actually hold — a KNOWN coin with balance, valuable NFT, trusted object */
export function isActiveAsset(o: WalletObject): boolean {
  return !o.protected && !isEmptyCoinObject(o) && o.classification === "keep";
}

function isDemoObject(o: WalletObject): boolean {
  return o.type.includes("::demo::");
}

function normCollection(collection: string): string {
  const c = collection.trim().toLowerCase();
  if (!c || c === "—" || c === "-" || c === "unknown" || c === "n/a") return "";
  return c;
}

interface Resolved {
  identity?: ProjectIdentity;
  title: string;
  subtitle: string;
  kind: GroupKind;
}

function resolve(o: WalletObject): Resolved {
  // coins — the inner coin type is the identity
  const inner = coinInnerType(o.type);
  if (o.category === "coin" || inner) {
    const identity =
      (inner ? findProjectByCoinType(inner) : undefined) ??
      (o.name ? findProjectByName(o.name) : undefined);
    if (identity) {
      return {
        identity,
        title: identity.symbol ?? identity.name,
        subtitle: identity.issuer ?? identity.name,
        kind: "token",
      };
    }
    // curated demo coins carry real names (HYPE, YOLO…) — keep them readable
    if (isDemoObject(o) && o.name && !/unknown/i.test(o.name)) {
      return { title: o.name, subtitle: "Demo token", kind: "token" };
    }
    // a real coin we don't recognize — show it as unknown with identity not verified
    return {
      title: "Unknown Token",
      subtitle: "Identity not verified",
      kind: "token",
    };
  }

  // NFTs — group by collection
  if (o.category === "nft") {
    const coll = normCollection(o.collection);
    if (!coll) {
      return { title: "Unknown NFT", subtitle: "Unknown collection", kind: "nft" };
    }
    const identity = findProjectByCollection(o.collection);
    if (identity) {
      return {
        identity,
        title: identity.name,
        subtitle: "NFT collection",
        kind: "nft",
      };
    }
    return { title: o.collection, subtitle: "NFT collection", kind: "nft" };
  }

  // protocol objects (known package / collection) — prefer a protocol-kind
  // identity so e.g. StakedSui reads as "Sui Staking", not the system package
  const byPackage = o.package ? findProjectByPackage(o.package) : undefined;
  const byCollection = o.collection ? findProjectByCollection(o.collection) : undefined;
  const identity =
    (byPackage?.kind === "protocol" ? byPackage : undefined) ??
    (byCollection?.kind === "protocol" ? byCollection : undefined) ??
    byPackage ??
    byCollection;
  if (identity?.kind === "protocol") {
    return {
      identity,
      title: identity.name,
      subtitle: identity.issuer ?? "Protocol object",
      kind: "protocol",
    };
  }
  if (identity?.kind === "collection") {
    return {
      identity,
      title: identity.name,
      subtitle: "Collection object",
      kind: "other",
    };
  }
  if (identity) {
    return { identity, title: identity.name, subtitle: identity.issuer ?? "Object", kind: "other" };
  }

  // curated demo objects carry real names — keep them readable
  if (isDemoObject(o) && o.name && !/unknown/i.test(o.name)) {
    return { title: o.name, subtitle: "Object", kind: "other" };
  }
  // try to determine the object class from the type
  const typeParts = o.type.split("::");
  const moduleName = typeParts[1] ?? "";
  let objectClass = "Unknown object";
  if (/nft|collection|mint|token/i.test(moduleName)) objectClass = "Unknown NFT";
  else if (/capability|cap|key/i.test(moduleName)) objectClass = "Unknown capability";
  else if (/protocol|pool|vault|position/i.test(moduleName)) objectClass = "Unknown protocol object";
  else if (/event|ticket|pass|badge|card/i.test(moduleName)) objectClass = "Unknown ticket or pass";
  return {
    title: objectClass,
    subtitle: "We could not identify this object",
    kind: "other",
  };
}

function statusOf(o: WalletObject): GroupStatus {
  if (o.protected) return "protected";
  if (o.classification === "review") return "review";
  if (o.cleanupAction) return "cleanable";
  if (o.classification === "keep") return "keep";
  return "review";
}

function dominantStatus(counts: Record<GroupStatus, number>): GroupStatus {
  for (const s of GROUP_STATUS_PRIORITY) if (counts[s] > 0) return s;
  return "review";
}

function groupKeyOf(o: WalletObject): string {
  const inner = coinInnerType(o.type);
  if (o.category === "coin" || inner) {
    // empty coin containers group separately from active ones — an empty Coin<T>
    // is a removable object (a vault), not a token holding. Dust coins (tiny
    // balances, merged during cleanup) group separately too, so an active
    // balance of the same token never shows as cleanable.
    if (isEmptyCoinObject(o)) return `empty:${inner ?? o.name}`;
    if (o.dust) return `dust:${inner ?? o.name}`;
    return `coin:${inner ?? o.name}`;
  }
  if (o.category === "nft") return `nft:${normCollection(o.collection)}`;
  // protocol objects group by protocol (not by raw type) — e.g. all DeepBook
  // positions collapse into one "DeepBook" group
  const identity = resolve(o).identity;
  if (identity?.kind === "protocol") return `proto:${identity.id}`;
  return `obj:${o.type}`;
}

/* ------------------------------- grouping --------------------------------- */

export function groupObjects(objects: WalletObject[]): GroupedWallet {
  const byKey = new Map<string, WalletGroup>();

  for (const o of objects) {
    const key = groupKeyOf(o);
    let g = byKey.get(key);
    if (!g) {
      const r = resolve(o);
      g = {
        id: key,
        title: r.title,
        subtitle: r.subtitle,
        kind: r.kind,
        status: "review",
        statusCounts: { keep: 0, protected: 0, review: 0, cleanable: 0 },
        count: 0,
        isEmptyCoins: key.startsWith("empty:"),
        identity: r.identity,
        mark: projectMark(r.identity, r.title),
        items: [],
      };
      byKey.set(key, g);
    }
    g.items.push(o);
    g.count += 1;
    g.statusCounts[statusOf(o)] += 1;
  }

  const groups = [...byKey.values()];
  for (const g of groups) {
    g.status = dominantStatus(g.statusCounts);
    // coin balance aggregation (base units)
    if (g.kind === "token") {
      const balances = g.items.map((i) => i.coinBalance).filter((b): b is string => b != null);
      if (balances.length === g.items.length) {
        let total = 0n;
        for (const b of balances) {
          try {
            total += BigInt(b);
          } catch {
            /* non-numeric balance — leave unset */
          }
        }
        g.coinBalance = total.toString();
      }
      const values = g.items.map((i) => i.value).filter((v): v is number => typeof v === "number");
      if (values.length === g.items.length && values.length > 0) {
        g.estValueUsd = values.reduce((a, b) => a + b, 0);
      }
    }
  }

  const sectionOf = (g: WalletGroup): SectionKey => {
    // NFTs always go to the nft section regardless of status
    if (g.kind === "nft") return "nft";
    // DeFi / protocol positions go to defi section
    if (g.kind === "protocol" || g.items.some((o) => !!o.position)) return "defi";
    if (g.status === "protected") return "protected";
    if (g.status === "cleanable") return g.isEmptyCoins ? "empty" : "other-cleanable";
    if (g.status === "keep") return "active";
    return "review";
  };

  const sections: GroupedSection[] = [
    { key: "active", title: "Assets", groups: [] },
    { key: "nft", title: "NFTs", groups: [] },
    { key: "defi", title: "DeFi & Positions", groups: [] },
    { key: "protected", title: "Protected", groups: [] },
    { key: "review", title: "Review", groups: [] },
    { key: "empty", title: "Empty coin objects", groups: [] },
    { key: "other-cleanable", title: "Other cleanable", groups: [] },
  ];

  for (const g of groups) {
    sections.find((s) => s.key === sectionOf(g))!.groups.push(g);
  }

  // within a section: dominant status, then count desc, then title
  const cmp = (a: WalletGroup, b: WalletGroup) => {
    const sa = GROUP_STATUS_PRIORITY.indexOf(a.status);
    const sb = GROUP_STATUS_PRIORITY.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  };
  for (const s of sections) s.groups.sort(cmp);

  const totals = { active: 0, nft: 0, defi: 0, protected: 0, review: 0, empty: 0, otherCleanable: 0, cleanable: 0 };
  const emptyTypes = new Set<string>();
  for (const o of objects) {
    // NFTs count as their own category
    if (o.category === "nft") {
      totals.nft += 1;
      continue;
    }
    // DeFi positions (objects with position data or protocol objects with position modules)
    if (o.category === "object" && o.position) {
      totals.defi += 1;
      continue;
    }
    if (o.protected) totals.protected += 1;
    else if (isEmptyCoinObject(o)) {
      totals.empty += 1;
      const inner = coinInnerType(o.type);
      if (inner) emptyTypes.add(inner);
    } else if (o.cleanupAction && o.classification !== "review") totals.otherCleanable += 1;
    else if (o.classification === "keep") totals.active += 1;
    else totals.review += 1;
  }
  totals.cleanable = totals.empty + totals.otherCleanable;

  return { total: objects.length, totals, emptyTokenTypes: emptyTypes.size, sections };
}

/* ------------------------------ aggregators ------------------------------- */

/** groups shown in the ASSETS tab — things you actually own */
export function aggregateActiveAssets(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects).sections.find((s) => s.key === "active")?.groups ?? [];
}

/** groups shown in the PROTECTED tab */
export function aggregateProtectedGroups(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects).sections.find((s) => s.key === "protected")?.groups ?? [];
}

/** groups shown in the REVIEW tab */
export function aggregateReviewGroups(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects).sections.find((s) => s.key === "review")?.groups ?? [];
}

/** empty (zero-balance) coin groups, grouped by coin type */
export function aggregateEmptyCoins(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects).sections.find((s) => s.key === "empty")?.groups ?? [];
}

/** every verified-removable group (empty coins + other cleanable) */
export function aggregateCleanupGroups(objects: WalletObject[]): WalletGroup[] {
  const g = groupObjects(objects);
  return [
    ...(g.sections.find((s) => s.key === "empty")?.groups ?? []),
    ...(g.sections.find((s) => s.key === "other-cleanable")?.groups ?? []),
  ];
}

/** NFT groups (any status) — grouped by collection */
export function aggregateNFTCollections(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects)
    .sections.flatMap((s) => s.groups)
    .filter((g) => g.kind === "nft");
}

/** protocol groups (any status) — grouped by protocol */
export function aggregateProtocols(objects: WalletObject[]): WalletGroup[] {
  return groupObjects(objects)
    .sections.flatMap((s) => s.groups)
    .filter((g) => g.kind === "protocol");
}

/* ------------------------------ DeFi tab ---------------------------------- */

/**
 * DeFi positions (LP, lending, LST, vault, CDP) for the "DeFi & Staking Pools"
 * tab — grouped by protocol. Only objects whose type came from a KNOWN
 * protocol package with a position-ish module are included (the classifier
 * already marks them REVIEW / withdraw via `position`).
 */
export function aggregateDeFiPositions(objects: WalletObject[]): WalletGroup[] {
  // Position-bearing objects live in protocol groups (Cetus Position, Scallop
  // Obligation…) AND in token groups (sCoin / sSUI are Coin<T> receipts with
  // a verified redeem entry point — see objectClassifier.defiCoinWithdraw).
  // Include every group whose items carry `position` data, whatever its kind.
  const groups = groupObjects(objects)
    .sections.flatMap((s) => s.groups)
    .map((g) => ({ ...g, items: g.items.filter((o) => !!o.position) }))
    .filter((g) => g.items.length > 0);
  // re-derive status from the filtered items
  for (const g of groups) {
    g.count = g.items.length;
    g.statusCounts = { keep: 0, protected: 0, review: 0, cleanable: 0 };
    for (const o of g.items) g.statusCounts[statusOf(o)] += 1;
    g.status = dominantStatus(g.statusCounts);
  }
  return groups.sort((a, b) => {
    const sa = GROUP_STATUS_PRIORITY.indexOf(a.status);
    const sb = GROUP_STATUS_PRIORITY.indexOf(b.status);
    if (sa !== sb) return sa - sb;
    return a.title.localeCompare(b.title);
  });
}

/** true when any object carries DeFi position data */
export function hasDeFiPositions(objects: WalletObject[]): boolean {
  return objects.some((o) => !!o.position);
}

/* --------------------------- search / filter ------------------------------ */

export type StatusFilter = "all" | GroupStatus;
export type KindFilter = "all" | "tokens" | "nfts" | "protocols" | "other";
export type SortKey = "name" | "importance" | "value" | "count" | "status";

/** search across name, symbol, issuer, collection, protocol, type, object id */
export function groupMatchesSearch(g: WalletGroup, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    g.title,
    g.subtitle,
    g.identity?.name,
    g.identity?.symbol,
    g.identity?.issuer,
    ...g.items.map((i) => i.name),
    ...g.items.map((i) => i.collection),
    ...g.items.map((i) => i.type),
    ...g.items.map((i) => i.objectId),
  ]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

const KIND_OF_GROUP: Record<GroupKind, Exclude<KindFilter, "all">> = {
  token: "tokens",
  nft: "nfts",
  protocol: "protocols",
  other: "other",
};

export function groupPassesFilters(g: WalletGroup, status: StatusFilter, kind: KindFilter): boolean {
  if (status !== "all") {
    if (status === "keep" && g.statusCounts.keep === 0) return false;
    if (status === "protected" && g.statusCounts.protected === 0) return false;
    if (status === "review" && g.statusCounts.review === 0) return false;
    if (status === "cleanable" && g.statusCounts.cleanable === 0) return false;
  }
  if (kind !== "all" && KIND_OF_GROUP[g.kind] !== kind) return false;
  return true;
}

export function sortGroups(groups: WalletGroup[], sort: SortKey): WalletGroup[] {
  const sorted = [...groups];
  const byImportance = (a: WalletGroup, b: WalletGroup) => {
    // value when reliable, then size, then name — never alphabetical first
    const va = a.estValueUsd ?? -1;
    const vb = b.estValueUsd ?? -1;
    if (vb !== va) return vb - va;
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  };
  switch (sort) {
    case "name":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "importance":
    case "value": {
      sorted.sort(byImportance);
      break;
    }
    case "count":
      sorted.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.title.localeCompare(b.title);
      });
      break;
    case "status":
      sorted.sort((a, b) => {
        const sa = GROUP_STATUS_PRIORITY.indexOf(a.status);
        const sb = GROUP_STATUS_PRIORITY.indexOf(b.status);
        if (sa !== sb) return sa - sb;
        return byImportance(a, b);
      });
      break;
    default:
      sorted.sort(byImportance);
  }
  return sorted;
}

/* ------------------------------ selection -------------------------------- */

/** ids of the objects inside a group that may enter cleanup (verified only) */
export function selectableIds(g: WalletGroup): string[] {
  return g.items.filter((o) => !!o.cleanupAction && !o.protected).map((o) => o.objectId);
}

/** ids of review items that can be selected for guarding/processing */
export function reviewSelectableIds(g: WalletGroup): string[] {
  return g.items.filter((o) => !o.protected && o.classification === "review").map((o) => o.objectId);
}

/** the objects in a wallet that are currently selected */
export function getSelectedItems(objects: WalletObject[], selected: Set<string>): WalletObject[] {
  return objects.filter((o) => selected.has(o.objectId));
}

export type SelectionState = "none" | "partial" | "all";

/** group-level selection state: all / partial / none of the selectable ids */
export function groupSelectionState(g: WalletGroup, selected: Set<string>): SelectionState {
  const ids = selectableIds(g);
  if (ids.length === 0) return "none";
  let hit = 0;
  for (const id of ids) if (selected.has(id)) hit += 1;
  if (hit === 0) return "none";
  return hit === ids.length ? "all" : "partial";
}

/** distinct coin types among the selected items — "3 token types" */
export function selectedTokenTypes(objects: WalletObject[], selected: Set<string>): number {
  const types = new Set<string>();
  for (const o of objects) {
    if (!selected.has(o.objectId)) continue;
    if (o.category === "coin") {
      const inner = coinInnerType(o.type);
      if (inner) types.add(inner);
    } else if (o.category === "nft") {
      types.add(`nft:${o.collection.trim().toLowerCase()}`);
    } else {
      types.add(`obj:${o.type}`);
    }
  }
  return types.size;
}

/* ------------------------------ formatting -------------------------------- */

/** base units → readable value with the token's own decimals ("128.42") */
export function formatBalance(baseUnits: string, decimals = 9): string {
  try {
    const v = BigInt(baseUnits);
    if (v === 0n) return "0";
    const scale = BigInt(10) ** BigInt(Math.max(0, Math.min(18, decimals)));
    const whole = v / scale;
    const frac = v % scale;
    if (frac === 0n) return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    let fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    if (fracStr.length > 4) fracStr = fracStr.slice(0, 4);
    return (
      whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") +
      "." +
      fracStr
    );
  } catch {
    return baseUnits;
  }
}

/**
 * The primary (large) balance label for a token group, or undefined when
 * there is no reliable way to format it (never invent decimals / prices).
 * Empty coin containers show "0 balance" — the value is zero, the object
 * is just an empty vault that occupies storage.
 */
export function groupBalanceLabel(g: WalletGroup): string | undefined {
  if (g.isEmptyCoins) return "0";
  if (g.coinBalance != null && g.identity?.decimals != null) {
    return `${formatBalance(g.coinBalance, g.identity.decimals)} ${g.identity.symbol ?? g.title}`;
  }
  if (g.coinBalance != null && g.identity?.id === "sui") {
    return `${formatBalance(g.coinBalance, 9)} SUI`;
  }
  return undefined;
}

/**
 * The secondary (small, muted) line under the primary balance: the USD
 * estimate when we have one and the primary label is a token amount, or a
 * human explanation for empty coin objects. The "safe to remove" phrasing
 * is deliberate: a zero-balance coin is an EMPTY OBJECT, not a token you
 * own — removing it never touches token value.
 */
export function groupBalanceSubLabel(g: WalletGroup): string | undefined {
  if (g.isEmptyCoins) return "safe to remove";
  if (g.estValueUsd !== undefined) return `est. $${g.estValueUsd}`;
  return undefined;
}

/** "12 empty coin objects" / "8 NFTs" / "3 protocol objects" / "23 objects" */
export function groupCountLabel(g: WalletGroup): string {
  const n = g.count;
  const plural = n === 1 ? "" : "s";
  if (g.isEmptyCoins) return `${n} empty coin object${plural}`;
  if (g.kind === "nft") return `${n} NFT${plural}`;
  if (g.kind === "protocol") return `${n} protocol object${plural}`;
  return `${n} object${plural}`;
}
