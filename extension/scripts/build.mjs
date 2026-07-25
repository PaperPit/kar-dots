import * as esbuild from "esbuild"
import { copyFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outdir = join(root, "dist")
mkdirSync(outdir, { recursive: true })
mkdirSync(join(root, "sidepanel"), { recursive: true })

const shared = {
  bundle: true,
  platform: "browser",
  target: ["chrome120"],
  sourcemap: false,
  logLevel: "info",
  absWorkingDir: root
}

// Service worker остаётся ESM (manifest background.type = module).
await esbuild.build({
  ...shared,
  entryPoints: { background: join(root, "src/background.ts") },
  outdir,
  format: "esm",
  splitting: false
})

// Content scripts — классические скрипты (не module).
await esbuild.build({
  ...shared,
  entryPoints: {
    "content-youtube": join(root, "src/content-youtube.ts"),
    "content-app-bridge": join(root, "src/content-app-bridge.ts")
  },
  outdir,
  format: "iife"
})

// Side Panel — IIFE рядом с HTML, без type=module (надёжнее в extension pages).
await esbuild.build({
  ...shared,
  entryPoints: [join(root, "src/sidepanel/sidepanel.ts")],
  outfile: join(root, "sidepanel/sidepanel.js"),
  format: "iife"
})

// На всякий случай копия в dist/ (для отладки).
copyFileSync(join(root, "sidepanel/sidepanel.js"), join(outdir, "sidepanel.js"))

console.log("extension build → extension/dist/ + extension/sidepanel/sidepanel.js")
