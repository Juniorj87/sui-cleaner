import {
  findProtocolByType,
  findProtocolByPackage,
  packageIdOfType,
  type KnownProtocol,
} from "../data/knownProtocols";

/**
 * Best-effort protocol detection from on-chain facts (type string and
 * package id). Returns undefined when the object is not from a known
 * protocol — in that case the classifier must NOT invent an identity.
 */
export function detectProtocol(type: string, packageId: string): KnownProtocol | undefined {
  return findProtocolByType(type) ?? findProtocolByPackage(packageId);
}

export { packageIdOfType };
