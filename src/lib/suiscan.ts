/**
 * SuiScan links — used everywhere an object can be opened on the explorer.
 *
 * The network MUST follow the app's configured network (mainnet / testnet);
 * mainnet links are never hardcoded when the app runs on testnet.
 */

/** normalize a network label to the SuiScan path segment */
export function suiscanNetwork(network: string): string {
  const n = network.trim().toLowerCase();
  if (n === "testnet" || n === "devnet" || n === "mainnet") return n;
  // anything else (custom RPC labels, empty) — mainnet is the safe default
  return "mainnet";
}

/** https://suiscan.xyz/<network>/object/<0x…> */
export function suiscanObjectUrl(network: string, objectId: string): string {
  const id = objectId.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(id)) return `https://suiscan.xyz/${suiscanNetwork(network)}/`;
  return `https://suiscan.xyz/${suiscanNetwork(network)}/object/${id}`;
}

/** https://suiscan.xyz/<network>/account/<0x…> */
export function suiscanAccountUrl(network: string, address: string): string {
  const a = address.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(a)) return `https://suiscan.xyz/${suiscanNetwork(network)}/`;
  return `https://suiscan.xyz/${suiscanNetwork(network)}/account/${a}`;
}

/**
 * https://suiscan.xyz/<network>/tx/<digest> — the network MUST follow the app config.
 *
 * Sui transaction digests are base58 (e.g. 5RcaXXqMnRUF5XwxdnRg4M3DXeGGv5UHZMN19h1JS3sb),
 * NOT 0x-hex — so any non-empty digest builds a direct /tx/ link. Only a
 * missing/blank digest falls back to the network home page.
 */
export function suiscanTxUrl(network: string, digest: string): string {
  const d = digest.trim();
  if (!d) return `https://suiscan.xyz/${suiscanNetwork(network)}/`;
  return `https://suiscan.xyz/${suiscanNetwork(network)}/tx/${d}`;
}
