import { el, modal } from "../../ui/ui.js"
import { modalHead } from "../../ui/brand.js"
import { t } from "../../lib/i18n.js"
import type { Folder } from "../../data/types.js"

/** Выбор папки для карточки из заметки. */
export function pickFolderDialog(folders: Folder[]): Promise<string | null> {
  return new Promise((resolve) => {
    const titleId = "note-pick-folder-title"
    const select = el(
      "select",
      { class: "note-folder-select", "aria-label": t("notes.folder.label") },
      folders.length
        ? folders.map((f) => el("option", { value: f.id }, f.name || f.id))
        : [el("option", { value: "" }, t("notes.folder.none"))]
    ) as HTMLSelectElement

    let settled = false
    const finish = (v: string | null) => {
      if (settled) return
      settled = true
      m.close()
      resolve(v)
    }

    const head = modalHead(t("notes.cardFromSelection.pickFolder"))
    const titleEl = head.querySelector(".modal-title")
    if (titleEl) titleEl.id = titleId

    const m = modal(
      el("div", null, [
        head,
        el("p", { class: "muted" }, t("notes.cardFromSelection.pickFolderHint")),
        select,
        el("div", { class: "modal-actions" }, [
          el("button", { class: "btn", type: "button", onclick: () => finish(null) }, t("common.cancel")),
          el(
            "button",
            {
              class: "btn accent",
              type: "button",
              onclick: () => finish(select.value || null),
              disabled: !folders.length,
            },
            t("common.ok")
          ),
        ]),
      ]),
      { labelledBy: titleId, onClose: () => finish(null) }
    )
  })
}
