import * as esbuild from "esbuild"
import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outdir = join(root, "dist")
mkdirSync(outdir, { recursive: true })

const entries = {
  background: join(root, "src/background.ts"),
  "content-youtube": join(root, "src/content-youtube.ts"),
  "content-app-bridge": join(root, "src/content-app-bridge.ts"),
  sidepanel: join(root, "src/sidepanel/sidepanel.ts")
}

await esbuild.build({
  entryPoints: entries,
  bundle: true,
  outdir,
  format: "esm",
  platform: "browser",
  target: ["chrome120"],
  sourcemap: true,
  logLevel: "info",
  // Chrome MV3 service worker + content scripts as separate files.
  splitting: false,
  // Allow importing shared app modules from ../../js
  absWorkingDir: root
})

console.log("extension build → extension/dist/")
