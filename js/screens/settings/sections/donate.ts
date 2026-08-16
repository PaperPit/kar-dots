import { el, toast } from "../../../ui/ui.js"
import { t } from "../../../lib/i18n.js"

/** USDT на Ethereum (ERC-20). */
export const USDT_ERC20_ADDRESS = "0x8c845fb26c4fe106a2867572aB8818C9fc9A8A87"

/** Страница Boosty автора. */
export const BOOSTY_URL = "https://boosty.to/kar_tochki"

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function buildDonateGroup() {
  return el("div", { class: "settings-group" }, [
    el("h4", null, t("settings.donate.title")),
    el("p", { class: "muted" }, t("settings.donate.lead")),
    el("div", { class: "setting-row" }, [
      el("div", { class: "lab" }, [
        el("b", null, "Boosty"),
        el("span", null, t("settings.donate.boostyHint"))
      ]),
      el(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: () => {
            window.open(BOOSTY_URL, "_blank", "noopener,noreferrer")
          }
        },
        t("common.open")
      )
    ]),
    el("div", { class: "setting-row" }, [
      el("div", { class: "lab" }, [
        el("b", null, "USDT (ERC-20)"),
        el("span", null, t("settings.donate.cryptoHint"))
      ]),
      el(
        "button",
        {
          class: "btn",
          type: "button",
          onclick: async () => {
            const ok = await copyText(USDT_ERC20_ADDRESS)
            toast(
              ok
                ? t("settings.donate.cryptoAddressCopied")
                : t("settings.donate.cryptoAddressCopyFailed"),
              ok ? "ok" : "error"
            )
          }
        },
        t("settings.donate.copyAddress")
      )
    ])
  ])
}
