// Windows-safe dev launcher.
//
// Why: on Windows the console code page defaults to the OEM/ANSI page
// (e.g. 866 or 1251 on a Russian-locale system). Vite/Node write UTF-8, so
// any Cyrillic in terminal output renders as mojibake (Р…, ╬…, U+FFFD…).
//
// This launcher:
//   1. switches the console to code page 65001 (UTF-8) — persists for the
//      whole console session, so npm/PowerShell/CMD output stays readable;
//   2. starts Vite programmatically with the exact same output as `vite`
//      (server.printUrls), so standard Vite behavior is preserved.
//
// Usage: npm run dev

import { spawnSync } from "node:child_process";

if (process.platform === "win32") {
  try {
    // Set the console code page for the attached console (cmd or PowerShell).
    // The redirect hides chcp's own "Active code page" line.
    spawnSync("cmd", ["/c", "chcp 65001>nul"], { stdio: "inherit", windowsHide: true });
  } catch {
    // Non-fatal: if chcp is unavailable, Vite still runs.
  }
}

const { createServer } = await import("vite");

const server = await createServer();
await server.listen();

server.printUrls();
server.bindCLIShortcuts({ print: true });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
