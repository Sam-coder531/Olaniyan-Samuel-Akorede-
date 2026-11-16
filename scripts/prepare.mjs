/**
 * AKOREDE FM — deployment bootstrap.
 *
 * Some deployment pipelines (notably Vercel's file-upload API when driven by a
 * JSON-capable connector) cannot receive a raw `package.json` object, because
 * JSON payloads get coerced into structured data instead of being uploaded as
 * literal text. To work around that, `package.json` is shipped as
 * `scripts/pkg.template`: the exact package manifest wrapped in marker
 * comments so it is *not* valid JSON and therefore survives transport as
 * plain text.
 *
 * This script extracts the manifest and writes a real `package.json` into the
 * project root before `npm install` runs. It is idempotent: if a valid
 * `package.json` already exists at the root it is left untouched.
 */
import fs from "node:fs";
import path from "node:path";

const START = "/*AKOREDE_PKG_START*/";
const END = "/*AKOREDE_PKG_END*/";

const root = process.cwd();
const target = path.join(root, "package.json");
const templatePath = path.join(root, "scripts", "pkg.template");

function alreadyValid() {
  if (!fs.existsSync(target)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(target, "utf8").replace(/^\uFEFF/, ""));
    return Boolean(parsed && typeof parsed === "object" && parsed.name);
  } catch {
    return false;
  }
}

if (alreadyValid()) {
  console.log("[prepare] package.json already present and valid — nothing to do.");
  process.exit(0);
}

if (!fs.existsSync(templatePath)) {
  console.error(`[prepare] Missing ${templatePath} and no usable package.json found.`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");
const start = template.indexOf(START);
const end = template.indexOf(END);

if (start === -1 || end === -1) {
  console.error("[prepare] Package manifest markers not found in scripts/pkg.template.");
  process.exit(1);
}

const manifest = template.slice(start + START.length, end).trim();

// Fail loudly rather than letting npm surface a confusing parse error later.
JSON.parse(manifest);

fs.writeFileSync(target, `${manifest}\n`);
console.log("[prepare] package.json written from scripts/pkg.template.");
