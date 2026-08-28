import { el, toast, confirmDialog } from "../../../ui/ui.js"
import { t } from "../../../lib/i18n.js"
import type { AppStore } from "../../../core/state.js"
import {
  cfEmail,
  cfLoggedIn,
  cfLogin,
  cfLogout,
  cfRegister,
  cfLastSyncAt
} from "../../../data/cf-auth.js"
import { cfPullIntoStore, cfPushFromStore, cfSyncNow } from "../../../data/cf-sync.js"

function formatSyncTime(ms: number): string {
  if (!ms) return t("settings.cfSync.never")
  try {
    return new Date(ms).toLocaleString()
  } catch {
    return String(ms)
  }
}

/** Cloudflare sync — для local-first режима (фаза 2). */
export function buildCfSyncGroup(store: AppStore, route: () => void | Promise<void>) {
  if (store.kind !== "local") return null

  const statusEl = el("span", { class: "integrations-status muted" }, "")
  const authFields = el("div", { class: "settings-cf-auth" }, [])

  function refreshStatus() {
    if (!cfLoggedIn()) {
      statusEl.textContent = t("settings.cfSync.signedOut")
      return
    }
    statusEl.textContent = t("settings.cfSync.signedIn", {
      email: cfEmail() || "",
      when: formatSyncTime(cfLastSyncAt())
    })
  }

  function renderAuthForm() {
    authFields.replaceChildren()
    if (cfLoggedIn()) return

    const emailInput = el("input", {
      type: "email",
      class: "input",
      placeholder: t("settings.cfSync.emailPlaceholder"),
      autocomplete: "email"
    }) as HTMLInputElement
    const passInput = el("input", {
      type: "password",
      class: "input",
      placeholder: t("settings.cfSync.passwordPlaceholder"),
      autocomplete: "new-password"
    }) as HTMLInputElement

    authFields.append(
      el("div", { class: "settings-cf-auth-row" }, [emailInput, passInput]),
      el("div", { class: "settings-cf-auth-actions" }, [
        el(
          "button",
          {
            class: "btn",
            type: "button",
            onclick: async () => {
              try {
                await cfLogin(emailInput.value, passInput.value)
                toast(t("settings.cfSync.loginOk"), "ok")
                refreshStatus()
                renderAuthForm()
                renderActions()
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "error")
              }
            }
          },
          t("settings.cfSync.login")
        ),
        el(
          "button",
          {
            class: "btn ghost",
            type: "button",
            onclick: async () => {
              try {
                await cfRegister(emailInput.value, passInput.value)
                toast(t("settings.cfSync.registerOk"), "ok")
                refreshStatus()
                renderAuthForm()
                renderActions()
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "error")
              }
            }
          },
          t("settings.cfSync.register")
        )
      ])
    )
  }

  const actionsEl = el("div", { class: "settings-cf-sync-actions" }, [])

  function renderActions() {
    actionsEl.replaceChildren()
    if (!cfLoggedIn()) return

    actionsEl.append(
      el(
        "button",
        {
          class: "btn accent",
          type: "button",
          onclick: async () => {
            try {
              const r = await cfSyncNow(store)
              if (r.status === "pulled") {
                toast(t("settings.cfSync.pulled"), "ok")
                await route()
              } else if (r.status === "pushed") {
                toast(t("settings.cfSync.pushed"), "ok")
              } else if (r.status === "conflict") {
                const yes = await confirmDialog(
                  t("settings.cfSync.conflictTitle"),
                  t("settings.cfSync.conflictText"),
                  t("settings.cfSync.conflictPull")
                )
                if (yes) {
                  await cfPullIntoStore(store)
                  toast(t("settings.cfSync.pulled"), "ok")
                  await route()
                }
              } else {
                toast(t("settings.cfSync.unchanged"), "ok")
              }
              refreshStatus()
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), "error")
            }
          }
        },
        t("settings.cfSync.syncNow")
      ),
      el(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: async () => {
            const yes = await confirmDialog(
              t("settings.cfSync.pushTitle"),
              t("settings.cfSync.pushText"),
              t("settings.cfSync.pushBtn")
            )
            if (!yes) return
            try {
              await cfPushFromStore(store)
              toast(t("settings.cfSync.pushed"), "ok")
              refreshStatus()
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), "error")
            }
          }
        },
        t("settings.cfSync.uploadOnly")
      ),
      el(
        "button",
        {
          class: "btn ghost",
          type: "button",
          onclick: async () => {
            const yes = await confirmDialog(
              t("settings.cfSync.pullTitle"),
              t("settings.cfSync.pullText"),
              t("settings.cfSync.pullBtn")
            )
            if (!yes) return
            try {
              await cfPullIntoStore(store)
              toast(t("settings.cfSync.pulled"), "ok")
              refreshStatus()
              await route()
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), "error")
            }
          }
        },
        t("settings.cfSync.downloadOnly")
      ),
      el(
        "button",
        {
          class: "btn ghost",
          type: "button",
          onclick: async () => {
            const yes = await confirmDialog(
              t("settings.cfSync.signOutTitle"),
              t("settings.cfSync.signOutText"),
              t("settings.cfSync.signOut")
            )
            if (!yes) return
            cfLogout()
            refreshStatus()
            renderAuthForm()
            renderActions()
            toast(t("settings.cfSync.signOutDone"), "ok")
          }
        },
        t("settings.cfSync.signOut")
      )
    )
  }

  refreshStatus()
  renderAuthForm()
  renderActions()

  return el("div", { class: "settings-group" }, [
    el("h4", null, t("settings.cfSync.title")),
    el("p", { class: "muted settings-sync-note" }, t("settings.cfSync.lead")),
    el("div", { class: "setting-row" }, [
      el("div", { class: "lab" }, [el("b", null, t("settings.cfSync.account")), statusEl]),
      actionsEl
    ]),
    authFields
  ])
}
