import * as esbuild from "esbuild"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outdir = join(root, "dist")
mkdirSync(outdir, { recursive: true })

/** Self-host: KAR_EXT_APP_ORIGIN=https://your.domain npm run ext:build */
const APP_ORIGIN = (process.env.KAR_EXT_APP_ORIGIN || "https://kar-tochki.pages.dev").replace(
  /\/+$/,
  ""
)

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
  splitting: false,
  absWorkingDir: root,
  define: {
    KAR_EXT_APP_ORIGIN: JSON.stringify(APP_ORIGIN)
  }
})

// Подставить origin в manifest host_permissions / content_scripts.
const manifestPath = join(root, "manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
const originPattern = `${APP_ORIGIN}/*`
manifest.host_permissions = (manifest.host_permissions || []).map((p) =>
  /kar-tochki\.pages\.dev/.test(p) || p.includes("APP_ORIGIN") ? originPattern : p
)
manifest.content_scripts = (manifest.content_scripts || []).map((cs) => ({
  ...cs,
  matches: (cs.matches || []).map((m) =>
    /kar-tochki\.pages\.dev/.test(m) ? originPattern : m
  )
}))
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n")

console.log(`extension build → extension/dist/ (APP_ORIGIN=${APP_ORIGIN})`)
