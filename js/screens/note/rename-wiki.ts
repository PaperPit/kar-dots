import { el, modal } from "../../ui/ui.js"
import { modalHead } from "../../ui/brand.js"
import { t } from "../../lib/i18n.js"

export type RenameHit = { id: string; title: string; count: number }

/** Подтверждение массовой правки [[Old]] → [[New]]. */
export function confirmWikiRename(opts: {
  oldTitle: string
  newTitle: string
  hits: RenameHit[]
}): Promise<boolean> {
  return new Promise((resolve) => {
    const titleId = "note-rename-wiki-title"
    const total = opts.hits.reduce((n, h) => n + h.count, 0)
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      m.close()
      resolve(ok)
    }

    const head = modalHead(t("notes.rename.title"))
    const titleEl = head.querySelector(".modal-title")
    if (titleEl) titleEl.id = titleId

    const m = modal(
      el("div", null, [
        head,
        el(
          "p",
          null,
          t("notes.rename.body", {
            old: opts.oldTitle,
            next: opts.newTitle,
            n: String(total),
            m: String(opts.hits.length),
          })
        ),
        el(
          "ul",
          { class: "note-rename-list" },
          opts.hits.map((h) =>
            el("li", null, `${h.title || t("notes.untitled")} — ${h.count}`)
          )
        ),
        el("div", { class: "modal-actions" }, [
          el("button", { class: "btn", type: "button", onclick: () => finish(false) }, t("common.cancel")),
          el(
            "button",
            { class: "btn accent", type: "button", onclick: () => finish(true) },
            t("notes.rename.confirm")
          ),
        ]),
      ]),
      { labelledBy: titleId, onClose: () => finish(false) }
    )
  })
}
