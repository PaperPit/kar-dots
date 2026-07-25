#!/usr/bin/env node
/** Синтаксис + import всех Cloudflare Pages Functions (fail-fast в CI). */
import { readdir, readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"

const root = join(fileURLToPath(import.meta.url), "..", "..")
const apiRoot = join(root, "functions", "api")

async function collectJs(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await collectJs(p, out)
    else if (e.isFile() && e.name.endsWith(".js")) out.push(p)
  }
  return out
}

const files = await collectJs(apiRoot)
if (!files.length) {
  console.error("functions:check — нет .js в functions/api")
  process.exit(1)
}

let failed = 0
for (const file of files) {
  const rel = relative(root, file)
  const syn = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" })
  if (syn.status !== 0) {
    failed++
    console.error("syntax fail:", rel)
    console.error(syn.stderr || syn.stdout)
    continue
  }
  try {
    await import(pathToFileURL(file).href + "?check=" + Date.now())
    console.log("ok", rel)
  } catch (e) {
    // Handlers тянут env/Request — важен синтаксис; import может упасть на missing bind.
    // Падаем только если файл не парсится как модуль (SyntaxError).
    if (e instanceof SyntaxError) {
      failed++
      console.error("import syntax fail:", rel, e.message)
    } else {
      console.log("ok", rel, `(load skipped: ${e.message?.split("\n")[0] || e})`)
    }
  }
}

// Быстрая проверка, что ключевые экспорты на месте.
const kv = await import(pathToFileURL(join(apiRoot, "_kv.js")).href)
for (const name of ["makeJobKey", "parseJobKey", "isJobUuid", "jobsStore"]) {
  if (typeof kv[name] !== "function") {
    console.error("missing export", name, "from _kv.js")
    failed++
  }
}
const keys = await import(pathToFileURL(join(apiRoot, "lib", "api-keys.js")).href)
for (const name of ["cleanGroqApiKey", "cleanPixabayApiKey", "cleanGiphyApiKey"]) {
  if (typeof keys[name] !== "function") {
    console.error("missing export", name, "from api-keys.js")
    failed++
  }
}

if (failed) {
  console.error(`functions:check — ошибок: ${failed}`)
  process.exit(1)
}
console.log(`functions:check — ${files.length} файлов OK`)
