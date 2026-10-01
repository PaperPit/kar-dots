import { el, confirmDialog } from "../../../ui/ui.js"
import { nav } from "../../../ui/navigation.js"
import { t } from "../../../lib/i18n.js"
import type { AppStore } from "../../../core/state.js"

export function buildAccountGroup(
  store: AppStore,
  _sb: unknown,
  setStore: (s: AppStore | null) => void,
  renderAuth: () => void,
  _route: () => void | Promise<void>
) {
  void store
  return el("div", { class: "settings-group" }, [
    el("h4", null, t("settings.account.title")),
    el("div", { class: "setting-row" }, [
      el("div", { class: "lab" }, [
        el("b", null, t("settings.account.localMode")),
        el("span", null, t("settings.account.localHint"))
      ]),
      el(
        "button",
        {
          class: "btn ghost",
          onclick: async () => {
            const yes = await confirmDialog(
              t("settings.account.signOutLocalTitle"),
              t("settings.account.signOutLocalText"),
              t("settings.account.signOut")
            )
            if (!yes) return
            localStorage.setItem("kar_mode", "local")
            setStore(null)
            nav("#home")
            renderAuth()
          }
        },
        t("settings.account.signOut")
      )
    ]),
    el("p", { class: "muted settings-account-note" }, t("settings.account.cfHint"))
  ])
}
