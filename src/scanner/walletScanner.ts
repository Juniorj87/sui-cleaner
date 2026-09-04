import { OBJECTS } from "../data/demo";
import {
  classifyDemo,
  classifyReal,
  aggregateStats,
  walletCondition,
  type WalletObject,
  type ScanStats,
  type OnchainFacts,
} from "./objectClassifier";
import { packageIdOfType } from "./protocolDetector";
import { proxyRpc, proxyGraphql, ProxyRpcError } from "../lib/proxyRpc";
import { normalizeAddress } from "../lib/suiAddress";
import { getAppConfig } from "../config";
import { coinInnerType } from "../lib/walletGroups";
import { findProjectByCoinType } from "../data/projectRegistry";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export interface ScanResult {
  source: "demo" | "onchain";
  objects: WalletObject[];
  stats: ScanStats;
  condition: number;
}

export class ScanError extends Error {
  code: "rpc-unavailable" | "network-mismatch" | "scan-failed" | "rate-limited";
  constructor(code: ScanError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** Demo scan — local demo data, no network. */
export function demoScan(): ScanResult {
  const objects = OBJECTS.map(classifyDemo);
  const stats = aggregateStats(objects);
  return { source: "demo", objects, stats, condition: walletCondition(stats) };
}

const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/*  shared normalization — one path for every transport               */
/* ------------------------------------------------------------------ */

/** minimal owned-object shape shared by the GraphQL and JSON-RPC transports */
interface OwnedObject {
  objectId: string;
  type?: string;
  digest?: string;
  version?: string;
  content?: { dataType?: string; fields?: Record<string, unknown> };
  display?: { data?: Record<string, unknown> | null };
  owner?: unknown;
  /** Move `store` ability / public_transfer (GraphQL hasPublicTransfer) */
  hasStore?: boolean;
}

interface OwnedPage {
  /** both transports put the object under item.data (may be absent) */
  data: { data?: unknown }[];
  hasNextPage: boolean;
  nextCursor?: string | null;
}

/**
 * GraphQL `type.repr` returns fully-padded addresses
 * (`0x0000…0002::coin::Coin<0x0000…0002::sui::SUI>`). The classifier,
 * protected-type rules and protocol registry all expect the canonical short
 * form (`0x2::…`), so every address run is trimmed to its shortest form.
 */
export function normalizeTypeRepr(repr: string): string {
  return repr.replace(/0x[0-9a-fA-F]+/g, (m) => {
    const hex = m.slice(2).replace(/^0+/, "");
    return "0x" + (hex === "" ? "0" : hex);
  });
}

function toWalletObject(o: OwnedObject): WalletObject {
  // ONE canonical type representation for every transport: GraphQL repr and
  // JSON-RPC provider types can arrive padded (`0x0000…0002::…`), so every
  // path is normalized to the canonical short form before classification,
  // storage, and (critically) pre-sign revalidation comparisons.
  const type = o.type ? normalizeTypeRepr(o.type) : "unknown";
  const content = o.content;
  const fields: Record<string, unknown> | undefined =
    content?.dataType === "moveObject" && content.fields
      ? (content.fields as Record<string, unknown>)
      : undefined;
  const balance = fields?.balance;
  const coinBalance =
    type.startsWith("0x2::coin::Coin<") && balance != null ? String(balance) : undefined;
  const displayData = o.display?.data;

  // Extract NFT image url if available
  const rawImageUrl =
    typeof displayData?.image_url === "string"
      ? displayData.image_url
      : typeof displayData?.img_url === "string"
      ? displayData.img_url
      : typeof displayData?.url === "string"
      ? displayData.url
      : typeof fields?.url === "string"
      ? (fields.url as string)
      : typeof fields?.image_url === "string"
      ? (fields.image_url as string)
      : undefined;

  // DeFi position fields (Cetus Position: { pool, coin_type_a, coin_type_b,
  // liquidity, … }) — carried so the withdraw step of the cleanup pipeline
  // can reference the pool and pair without extra RPC calls.
  const positionFields: OnchainFacts["positionFields"] =
    fields && (fields.pool || fields.pool_id)
      ? {
          poolId: String(fields.pool ?? fields.pool_id ?? "") || undefined,
          coinTypeA: typeof fields.coin_type_a === "string" ? fields.coin_type_a : undefined,
          coinTypeB: typeof fields.coin_type_b === "string" ? fields.coin_type_b : undefined,
          liquidity: fields.liquidity != null ? String(fields.liquidity) : undefined,
        }
      : undefined;

  const owner = o.owner;
  const ownerKind: OnchainFacts["ownerKind"] =
    owner && typeof owner === "object" && "AddressOwner" in owner
      ? "address"
      : owner && typeof owner === "object" && "ObjectOwner" in owner
        ? "object"
        : owner && typeof owner === "object" && "Shared" in owner
          ? "shared"
          : "immutable";

  const facts: OnchainFacts = {
    objectId: o.objectId,
    type,
    packageId: packageIdOfType(type),
    category: type.startsWith("0x2::coin::Coin<")
      ? "coin"
      : rawImageUrl || typeof fields?.name === "string"
        ? "nft"
        : "object",
    coinBalance,
    name:
      typeof displayData?.name === "string"
        ? displayData.name
        : typeof fields?.name === "string"
          ? (fields.name as string)
          : undefined,
    collection:
      typeof displayData?.collection === "string" ? displayData.collection : undefined,
    imageUrl: rawImageUrl,
    ownerKind,
    hasStore: o.hasStore,
    positionFields,
  };

  const spamPackages = getAppConfig()?.spamPackages
    ? new Set(getAppConfig()!.spamPackages)
    : undefined;
  const classified = classifyReal(facts, { spamPackages });
  // capture the live digest/version so cleanup revalidation can detect changes
  classified.digest = o.digest;
  classified.version = o.version;
  if (rawImageUrl) {
    classified.imageUrl = rawImageUrl;
  }
  return classified;
}

/**
 * Paginate owned objects and normalize through the shared classifier.
 * getPage returns one page in the standard page shape
 * ({ data: [{ data }], hasNextPage, nextCursor }) — all transports agree.
 */
async function scanLoop(getPage: (cursor: string | null) => Promise<OwnedPage>): Promise<ScanResult> {
  const objects: WalletObject[] = [];
  let cursor: string | null = null;

  try {
    do {
      const page = await getPage(cursor);
      cursor = page.hasNextPage ? (page.nextCursor ?? null) : null;
      for (const item of page.data ?? []) {
        const o = item.data as OwnedObject | undefined;
        if (!o) continue;
        objects.push(toWalletObject(o));
      }
    } while (cursor);
  } catch (e) {
    if (e instanceof ScanError) throw e;
    if (e instanceof ProxyRpcError) {
      if (e.code === "rate-limited") {
        throw new ScanError("rate-limited", "Too many requests. Try again shortly.");
      }
      throw new ScanError("rpc-unavailable", "RPC unavailable. Check your connection and try again.");
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch|network|ECONN|timeout|503|429/i.test(msg)) {
      throw new ScanError("rpc-unavailable", "RPC unavailable. Check your connection and try again.");
    }
    throw new ScanError("scan-failed", "Scan failed. The wallet may be on a different network.");
  }

  const stats = aggregateStats(objects);
  return { source: "onchain", objects, stats, condition: walletCondition(stats) };
}

/**
 * Run the scan through the preferred transport, falling back to a secondary
 * one when the preferred transport fails (e.g. GraphQL down → JSON-RPC).
 * A failed page in the middle of pagination restarts on the fallback so one
 * scan always uses a single consistent transport.
 */
async function scanOwnedObjects(
  primary: (cursor: string | null) => Promise<OwnedPage>,
  fallback?: (cursor: string | null) => Promise<OwnedPage>
): Promise<ScanResult> {
  let lastError: unknown;
  for (const getPage of fallback ? [primary, fallback] : [primary]) {
    try {
      return await scanLoop(getPage);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof ScanError
    ? lastError
    : new ScanError("scan-failed", "Scan failed. The wallet may be on a different network.");
}

/* ------------------------------ GraphQL transport --------------------------- */

interface GqlMoveValue {
  json?: unknown;
  type?: { repr?: string };
  display?: { output?: string | null };
}

interface GqlOwner {
  __typename?: string;
  address?: { address?: string };
  initialSharedVersion?: number | string;
}

interface GqlObjectNode {
  address: string;
  version?: number;
  digest?: string;
  hasPublicTransfer?: boolean;
  contents?: GqlMoveValue | null;
  owner?: GqlOwner | null;
}

interface GqlOwnedObjectsData {
  address?: {
    objects?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      nodes?: GqlObjectNode[] | null;
    } | null;
  } | null;
}

const OWNED_OBJECTS_QUERY = `query GetOwnedObjects($owner: SuiAddress!, $cursor: String) {
  address(address: $owner) {
    objects(first: ${PAGE_SIZE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        address
        version
        digest
        hasPublicTransfer
        contents {
          json
          type { repr }
          display { output }
        }
        owner {
          __typename
          ... on AddressOwner { address { address } }
          ... on ObjectOwner { address { address } }
          ... on Shared { initialSharedVersion }
          ... on Immutable { _ }
        }
      }
    }
  }
}`;

function graphqlNodeToOwnedObject(node: GqlObjectNode): OwnedObject {
  const json = node.contents?.json as Record<string, unknown> | undefined;
  let displayData: Record<string, unknown> | undefined;
  const output = node.contents?.display?.output;
  if (typeof output === "string") {
    try {
      const parsed = JSON.parse(output);
      if (parsed && typeof parsed === "object") displayData = parsed as Record<string, unknown>;
    } catch {
      /* malformed display output — ignore */
    }
  }

  let owner: unknown;
  switch (node.owner?.__typename) {
    case "AddressOwner":
      owner = { AddressOwner: node.owner.address?.address };
      break;
    case "ObjectOwner":
      owner = { ObjectOwner: node.owner.address?.address };
      break;
    case "Shared":
      owner = { Shared: { initial_shared_version: node.owner.initialSharedVersion ?? null } };
      break;
    default:
      owner = { Immutable: true };
  }

  return {
    objectId: node.address,
    type: node.contents?.type?.repr ? normalizeTypeRepr(node.contents.type.repr) : undefined,
    digest: node.digest,
    version: node.version != null ? String(node.version) : undefined,
    content: json ? { dataType: "moveObject", fields: json } : undefined,
    display: displayData ? { data: displayData } : undefined,
    owner,
    hasStore: node.hasPublicTransfer,
  };
}

function graphqlOwnedPage(address: string, cursor: string | null): Promise<OwnedPage> {
  return proxyGraphql<GqlOwnedObjectsData>(OWNED_OBJECTS_QUERY, {
    owner: address,
    cursor,
  }).then((data) => {
    const objects = data?.address?.objects;
    const nodes = objects?.nodes ?? [];
    return {
      data: nodes.map((n) => ({ data: graphqlNodeToOwnedObject(n) })),
      hasNextPage: objects?.pageInfo?.hasNextPage ?? false,
      nextCursor: objects?.pageInfo?.endCursor ?? null,
    };
  });
}

/* ------------------------------ JSON-RPC transport -------------------------- */

function rpcOwnedPage(
  client: SuiJsonRpcClient,
  address: string,
  cursor: string | null
): Promise<OwnedPage> {
  return client.getOwnedObjects({
    owner: address,
    cursor,
    limit: PAGE_SIZE,
    options: { showType: true, showContent: true, showDisplay: true, showOwner: true },
  });
}

import { resolveBatchMetadata, formatCoinBalance, extractCoinSymbol } from "../lib/tokenMetadata";

/**
 * Post-scan enrichment: resolve CoinMetadata for all coin types.
 * Updates symbols, names, decimals, formatted balances, and logos so the UI
 * displays crystal-clear token information.
 */
async function enrichAllTokens(objects: WalletObject[]): Promise<void> {
  const coinTypes = new Set<string>();
  for (const o of objects) {
    if (o.category !== "coin") continue;
    const inner = coinInnerType(o.type);
    if (inner) coinTypes.add(inner);
  }

  if (coinTypes.size === 0) return;

  try {
    const metadata = await resolveBatchMetadata([...coinTypes]);
    if (metadata.size === 0) return;

    for (const o of objects) {
      if (o.category !== "coin") continue;
      const inner = coinInnerType(o.type);
      if (!inner) continue;
      const meta = metadata.get(inner);
      if (!meta) continue;

      const symbol = meta.symbol || o.symbol || extractCoinSymbol(inner);
      const tokenName = meta.name || meta.symbol || o.name || symbol;
      const decimals = meta.decimals ?? o.decimals ?? 9;
      const iconUrl = meta.iconUrl || o.iconUrl;
      const formattedBalance = formatCoinBalance(o.coinBalance, decimals);

      o.symbol = symbol;
      o.decimals = decimals;
      if (iconUrl) o.iconUrl = iconUrl;
      o.formattedBalance = formattedBalance;

      if (o.coinBalance === "0") {
        o.name = `${symbol} (Empty Coin)`;
        o.collection = "Spent Coin Object";
        o.reason = `Empty spent coin (${symbol}) — zero balance. Safe to destroy to reclaim +0.0028 SUI storage rebate.`;
      } else {
        o.name = tokenName;
        if (meta.description && (o.collection === "Unknown" || o.collection === "Coin")) {
          o.collection = meta.description;
        }
      }
    }
  } catch {
    /* enrichment failed gracefully, baseline objects remain valid */
  }
}

/**
 * Real on-chain scan of a wallet. Prefers the same-origin GraphQL proxy
 * (modern Sui RPC standard) and falls back to the wallet client's JSON-RPC
 * transport when GraphQL is unavailable.
 */
export async function scanWallet(
  client: SuiJsonRpcClient,
  address: string
): Promise<ScanResult> {
  const full = normalizeAddress(address);
  const result = await scanOwnedObjects(
    (cursor) => graphqlOwnedPage(full, cursor),
    (cursor) => rpcOwnedPage(client, full, cursor)
  );
  // Synchronous enrichment before displaying report
  await enrichAllTokens(result.objects);
  return result;
}

/**
 * Read-only scan of ANY Sui address through the same-origin proxy
 * (no wallet connection, no CORS). Same pagination, same classifier —
 * only the transport differs.
 */
export async function scanWalletReadonly(address: string): Promise<ScanResult> {
  const full = normalizeAddress(address);
  const result = await scanOwnedObjects(
    (cursor) => graphqlOwnedPage(full, cursor),
    (cursor) =>
      proxyRpc<OwnedPage>("suix_getOwnedObjects", [
        full,
        { options: { showType: true, showContent: true, showDisplay: true, showOwner: true } },
        cursor,
        PAGE_SIZE,
      ])
  );
  // Synchronous enrichment before displaying report
  await enrichAllTokens(result.objects);
  return result;
}
