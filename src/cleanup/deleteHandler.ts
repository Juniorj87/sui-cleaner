import type { WalletObject } from "../scanner/objectClassifier";

export interface DeleteCommand {
  action: "delete";
  requiresModuleEntry: boolean;
  entry?: string; // package::module::function once verified (Phase 5)
  description: string;
  preview: string;
}

/**
 * Real object deletion on Sui requires unpacking the struct, which can only
 * happen inside the module that defines the type. A generic cleaner cannot
 * delete arbitrary NFTs — only when the collection package exposes a
 * verified burn/delete entry function can we build a delete command.
 *
 * During the demo phase no such entries are verified, so this handler
 * returns nothing for real usage; demo objects get a preview description.
 */
export function deleteCommand(object: WalletObject, demo: boolean): DeleteCommand | undefined {
  if (!demo) return undefined;

  return {
    action: "delete",
    requiresModuleEntry: true,
    entry: `${object.package}::demo::burn`,
    description: "Delete the object via its verified module entry (demo).",
    preview: `delete — ${short(object.name)}`,
  };
}

function short(name: string): string {
  return name.length > 28 ? `${name.slice(0, 26)}…` : name;
}
