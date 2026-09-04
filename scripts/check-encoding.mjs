// Encoding audit for the project.
//
// Checks every source text file for:
//   - UTF-8 BOM
//   - invalid UTF-8 (would render as mojibake)
//   - U+FFFD replacement characters (already-corrupted content)
//   - likely Windows-1251 / CP866 content
//
// Usage: node scripts/check-encoding.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();

const EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".md", ".html", ".css",
  ".editorconfig", ".npmrc", ".gitignore",
]);

const NAMES = new Set(["vite.config.ts", "package.json", "package-lock.json", "tsconfig.json"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === "artifacts" || name === ".git") continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(full)) || NAMES.has(name)) out.push(full);
  }
  return out;
}

const dec = new TextDecoder("utf-8", { fatal: true });
const dec1251 = new TextDecoder("windows-1251");
const dec866 = new TextDecoder("ibm866");

let problems = 0;
let files = 0;

for (const file of walk(ROOT)) {
  const buf = readFileSync(file);
  if (buf.includes(0x00)) continue; // binary
  files++;

  const rel = file.slice(ROOT.length + 1).replace(/\\/g, "/");
  const issues = [];

  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    issues.push("UTF-8 BOM present");
  }

  let text;
  try {
    text = dec.decode(buf);
  } catch {
    // not valid UTF-8 — try common Windows encodings
    const as1251 = dec1251.decode(buf);
    const as866 = dec866.decode(buf);
    const sample = Array.from(buf.slice(0, 24))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    issues.push(
      `INVALID UTF-8 (bytes: ${sample}); decodes as windows-1251: "${as1251.slice(0, 40)}" / ibm866: "${as866.slice(0, 40)}"`
    );
  }

  if (text && text.includes("\uFFFD")) {
    issues.push("contains U+FFFD replacement char (corrupted content)");
  }

  if (issues.length) {
    problems++;
    console.log(`✗ ${rel}`);
    for (const i of issues) console.log(`    ${i}`);
  }
}

console.log(`\nScanned ${files} text files. ${problems === 0 ? "All files are clean UTF-8 (no BOM)." : `${problems} file(s) need attention.`}`);
process.exit(problems === 0 ? 0 : 1);
