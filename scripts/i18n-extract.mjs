#!/usr/bin/env node
/**
 * Scan TypeScript sources for Cyrillic UI literals and t()/tp() usage.
 *
 * Usage:
 *   node scripts/i18n-extract.mjs
 *   node scripts/i18n-extract.mjs --dirs=js/screens/home,js/ui/shell.ts
 *   node scripts/i18n-extract.mjs --write-stubs
 *   node scripts/i18n-extract.mjs --check --dirs=js/screens/home
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

const args = process.argv.slice(2)
const WRITE_STUBS = args.includes("--write-stubs")
const CHECK = args.includes("--check")
const dirsArg = args.find((a) => a.startsWith("--dirs="))
const DIRS = dirsArg
  ? dirsArg
      .slice("--dirs=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : ["js"]

const CYR = /\p{Script=Cyrillic}/u
const SKIP_DIR = new Set([
  "node_modules",
  "dist",
  "coverage",
  ".git",
  "www",
  "extension/dist"
])

function shouldSkipFile(rel) {
  if (!rel.endsWith(".ts")) return true
  if (rel.endsWith(".d.ts")) return true
  if (/\.test\.ts$/.test(rel)) return true
  if (rel.includes("/locales/")) return true
  if (rel.endsWith("/i18n.ts")) return true
  return false
}

function walk(abs, out = []) {
  const st = fs.statSync(abs)
  if (st.isDirectory()) {
    const base = path.basename(abs)
    if (SKIP_DIR.has(base)) return out
    for (const name of fs.readdirSync(abs)) {
      walk(path.join(abs, name), out)
    }
    return out
  }
  const rel = path.relative(ROOT, abs).split(path.sep).join("/")
  if (!shouldSkipFile(rel)) out.push(abs)
  return out
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
}

function lineAt(src, index) {
  return src.slice(0, index).split("\n").length
}

function suggestKey(rel, text) {
  const parts = rel.replace(/^js\//, "").replace(/\.ts$/, "").split("/")
  let ns = "common"
  if (parts[0] === "screens" && parts[1]) ns = parts[1]
  else if (parts[0] === "ui") {
    if (parts[1]?.startsWith("shell")) ns = "shell"
    else if (parts[1]?.startsWith("home")) ns = "home"
    else if (parts[1]?.startsWith("navigation")) ns = "common"
    else ns = "ui"
  } else if (parts[0] === "lib") ns = "lib"
  else if (parts[0] === "data") ns = "data"
  else if (parts[0] === "core") ns = "app"

  const slug = String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
  return `${ns}.${slug || "msg"}`
}

function collectFiles() {
  const files = []
  for (const d of DIRS) {
    const abs = path.resolve(ROOT, d)
    if (!fs.existsSync(abs)) {
      console.warn(`[i18n-extract] missing path: ${d}`)
      continue
    }
    walk(abs, files)
  }
  return [...new Set(files)]
}

function extractFromFile(abs) {
  const rel = path.relative(ROOT, abs).split(path.sep).join("/")
  const raw = fs.readFileSync(abs, "utf8")
  const src = stripComments(raw)
  const literals = []
  const wrapped = []

  const litRe = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g
  let m
  while ((m = litRe.exec(src))) {
    const quote = m[1]
    const body = m[2]
    const decoded = body
      .replace(/\\n/g, "\n")
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
    if (!CYR.test(decoded)) continue
    const before = src.slice(Math.max(0, m.index - 24), m.index)
    if (/from\s*$/.test(before) || /import\s*\(\s*$/.test(before)) continue
    literals.push({
      file: rel,
      line: lineAt(src, m.index),
      text: decoded.slice(0, 120),
      suggestedKey: suggestKey(rel, decoded),
      wrapped: false,
      template: quote === "`" && body.includes("${")
    })
  }

  const tRe = /\btp?\(\s*['"]([^'"]+)['"]/g
  while ((m = tRe.exec(src))) {
    wrapped.push({ file: rel, line: lineAt(src, m.index), key: m[1] })
  }

  return { literals, wrapped }
}

function loadRuKeys() {
  const ruPath = path.join(ROOT, "js/lib/locales/ru.ts")
  if (!fs.existsSync(ruPath)) return new Set()
  const src = fs.readFileSync(ruPath, "utf8")
  const keys = new Set()
  const re = /["']([^"']+)["']\s*:/g
  let m
  while ((m = re.exec(src))) keys.add(m[1])
  return keys
}

function main() {
  const files = collectFiles()
  const literals = []
  const wrapped = []
  for (const f of files) {
    const r = extractFromFile(f)
    literals.push(...r.literals)
    wrapped.push(...r.wrapped)
  }

  const ruKeys = loadRuKeys()
  const usedKeys = new Set(wrapped.map((w) => w.key))
  const orphanKeys = [...ruKeys].filter((k) => !usedKeys.has(k)).sort()
  const missingInRu = [...usedKeys].filter((k) => !ruKeys.has(k)).sort()

  const report = {
    generatedAt: new Date().toISOString(),
    dirs: DIRS,
    fileCount: files.length,
    literalCount: literals.length,
    wrappedCount: wrapped.length,
    orphanKeyCount: orphanKeys.length,
    missingInRuCount: missingInRu.length,
    literals,
    wrapped,
    orphanKeys,
    missingInRu
  }

  const outPath = path.join(ROOT, "scripts/i18n-report.json")
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n")

  console.log(
    `[i18n-extract] files=${files.length} cyrillicLiterals=${literals.length} tCalls=${wrapped.length} orphanKeys=${orphanKeys.length} missingInRu=${missingInRu.length}`
  )
  console.log(`[i18n-extract] wrote ${path.relative(ROOT, outPath)}`)

  if (WRITE_STUBS) {
    const ruPath = path.join(ROOT, "js/lib/locales/ru.ts")
    let src = fs.readFileSync(ruPath, "utf8")
    const missing = literals.filter((l) => !ruKeys.has(l.suggestedKey))
    const unique = new Map()
    for (const l of missing) {
      if (!unique.has(l.suggestedKey)) unique.set(l.suggestedKey, l.text)
    }
    if (unique.size) {
      const stubLines = [...unique.entries()]
        .map(([k, text]) => `  ${JSON.stringify(k)}: ${JSON.stringify(text)},`)
        .join("\n")
      src = src.replace(
        /\n\} as const satisfies/,
        `\n  // —— stubs from i18n-extract ——\n${stubLines}\n} as const satisfies`
      )
      fs.writeFileSync(ruPath, src)
      console.log(`[i18n-extract] wrote ${unique.size} stubs into js/lib/locales/ru.ts`)
    } else {
      console.log("[i18n-extract] no new stubs")
    }
  }

  if (CHECK && literals.length > 0) {
    console.error(
      `[i18n-extract] --check failed: ${literals.length} Cyrillic literal(s) remain in: ${DIRS.join(", ")}`
    )
    for (const l of literals.slice(0, 30)) {
      console.error(
        `  ${l.file}:${l.line} ${JSON.stringify(l.text)}${l.template ? " (template)" : ""}`
      )
    }
    if (literals.length > 30) console.error(`  …and ${literals.length - 30} more`)
    process.exit(1)
  }
}

main()
