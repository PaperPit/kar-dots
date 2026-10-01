import { store, app, setStore } from "../../core/state.js"
import { el, toast, spinner } from "../../ui/ui.js"
import { LocalStore } from "../../data/index.js"
import { FOLDER_COLORS } from "../../ui/constants.js"
import { brandMark, ghostBox } from "../../ui/helpers.js"
import { nav } from "../../ui/navigation.js"
import { route } from "../../core/router.js"
import { animateFadeIn } from "../../ui/motion-lazy.js"
import { applyUiLocale, t } from "../../lib/i18n.js"

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function renderAuth(busyMsg?: string) {
  if (!app) return
  app.innerHTML = ""
  const content = el("div", { class: "auth-wrap" }, [])
  content.append(
    ghostBox(),
    brandMark({ heading: true }),
    el("p", { class: "auth-sub" }, t("auth.sub"))
  )

  if (busyMsg) {
    content.append(
      el("div", { class: "center-pad" }, [
        spinner(undefined),
        el("p", { class: "auth-note" }, busyMsg)
      ])
    )
    app.append(el("main", { class: "main" }, content))
    requestAnimationFrame(() => animateFadeIn(content))
    return
  }

  const localBtn = el(
    "button",
    {
      class: "btn primary block big",
      onclick: async () => {
        localStorage.setItem("kar_mode", "local")
        renderAuth(t("auth.opening"))
        await enterLocal()
      }
    },
    t("auth.tryLocal")
  ) as HTMLButtonElement

  content.append(
    localBtn,
    el("p", { class: "auth-note" }, t("auth.demoNote")),
    el("p", { class: "auth-note muted" }, t("auth.cfSyncHint"))
  )
  app.append(el("main", { class: "main" }, content))
  requestAnimationFrame(() => animateFadeIn(content))
}

export async function enterLocal() {
  localStorage.setItem("kar_mode", "local")
  const local = new LocalStore()
  await local.init()
  setStore(local)
  applyUiLocale(local.settings.language)
  if (!store.folders.length && !localStorage.getItem("kar_seeded")) {
    localStorage.setItem("kar_seeded", "1")
    const f = await local.createFolder({ name: t("auth.seed.folderName"), color: FOLDER_COLORS[0] })
    await local.createCard({
      folder_id: f.id,
      front: t("auth.seed.cardFront"),
      back: t("auth.seed.cardBack")
    })
  }
  nav("#home")
  await route()
}

/** @deprecated Cloudflare sync lives in Settings; Supabase cloud removed. */
export async function enterCloud() {
  toast(t("auth.cloudRemoved"), "error")
  localStorage.setItem("kar_mode", "local")
  await enterLocal()
}

/** No-op: legacy CloudStore reload hook removed. */
export function attachCloudDataReload(_cloud?: unknown) {
  void _cloud
  void errMsg
}
