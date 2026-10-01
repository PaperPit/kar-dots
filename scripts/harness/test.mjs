#!/usr/bin/env node
/**
 * L0/L1 самотест обвязки агента (harness), не продукта.
 * Без сети, без LLM. Код 0 = зелено, 1 = красно.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const AGENTS_MAX_LINES = 150
const STATES = new Set(["not_started", "active", "blocked", "passing"])

let failed = 0
let passed = 0

function ok(msg) {
  passed++
  console.log(`  ok  ${msg}`)
}

function fail(msg) {
  failed++
  console.error(`  FAIL ${msg}`)
}

function assert(cond, msg) {
  if (cond) ok(msg)
  else fail(msg)
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8")
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel))
}

console.log("harness: structure")
assert(exists("AGENTS.md"), "AGENTS.md exists")
assert(exists("CLAUDE.md"), "CLAUDE.md exists")
assert(exists("feature_list.json"), "feature_list.json exists")
assert(exists("PROGRESS.md"), "PROGRESS.md exists")
assert(exists("docs/AGENT.md"), "docs/AGENT.md exists")
assert(exists("docs/ARCHITECTURE.md"), "docs/ARCHITECTURE.md exists")

console.log("harness: AGENTS.md budget + sections")
const agents = read("AGENTS.md")
const agentsLines = agents.split(/\r?\n/).length
assert(agentsLines <= AGENTS_MAX_LINES, `AGENTS.md ≤ ${AGENTS_MAX_LINES} lines (got ${agentsLines})`)
assert(/## Команды/.test(agents), "AGENTS.md has ## Команды")
assert(/Definition of Done|## Definition of Done/i.test(agents), "AGENTS.md has Definition of Done")
assert(/check:quick/.test(agents), "AGENTS.md mentions check:quick")
assert(/feature_list\.json/.test(agents), "AGENTS.md mentions feature_list.json")
assert(/PROGRESS\.md/.test(agents), "AGENTS.md mentions PROGRESS.md")

console.log("harness: feature_list.json")
let features
try {
  features = JSON.parse(read("feature_list.json"))
  ok("feature_list.json is valid JSON")
} catch (e) {
  fail(`feature_list.json parse: ${e instanceof Error ? e.message : e}`)
  features = []
}
assert(Array.isArray(features), "feature_list.json is an array")
assert(features.length >= 1, "feature_list.json has at least one item")

let activeCount = 0
for (const [i, f] of features.entries()) {
  assert(f && typeof f === "object", `feature[${i}] is object`)
  assert(typeof f.id === "string" && f.id, `feature[${i}].id`)
  assert(typeof f.behavior === "string" && f.behavior, `feature[${i}].behavior`)
  assert(typeof f.verification === "string" && f.verification, `feature[${i}].verification`)
  assert(STATES.has(f.state), `feature[${i}].state is one of ${[...STATES].join("|")}`)
  if (f.state === "active") activeCount++
}
assert(activeCount <= 1, `at most one active feature (got ${activeCount})`)

console.log("harness: package.json scripts")
const pkg = JSON.parse(read("package.json"))
const scripts = pkg.scripts || {}
assert(typeof scripts["check:quick"] === "string", "scripts.check:quick exists")
assert(typeof scripts.check === "string", "scripts.check exists")
assert(typeof scripts["harness:test"] === "string", "scripts.harness:test exists")
assert(
  /typecheck/.test(scripts["check:quick"]) && /lint/.test(scripts["check:quick"]),
  "check:quick runs typecheck and lint"
)
assert(/i18n:check/.test(scripts.check), "check includes i18n:check (CI parity)")

console.log("harness: CLAUDE.md / cursor rule point at AGENTS.md")
assert(/AGENTS\.md/.test(read("CLAUDE.md")), "CLAUDE.md links AGENTS.md")
assert(
  exists(".cursor/rules/kar-agent-workflow.mdc") &&
    /AGENTS\.md/.test(read(".cursor/rules/kar-agent-workflow.mdc")),
  "cursor rule references AGENTS.md"
)

console.log("harness: ARCHITECTURE mentions local-first / CF sync")
const arch = read("docs/ARCHITECTURE.md")
assert(/local-first|LocalStore|local\b/i.test(arch), "ARCHITECTURE mentions local mode")
assert(/D1|cf-sync|Cloudflare sync/i.test(arch), "ARCHITECTURE mentions CF sync / D1")

console.log("")
if (failed) {
  console.error(`harness: FAILED (${failed} fail, ${passed} pass)`)
  process.exit(1)
}
console.log(`harness: ALL PASSED (${passed} assertions)`)
