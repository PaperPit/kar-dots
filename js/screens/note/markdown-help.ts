import { el, modal } from "../../ui/ui.js"
import { modalHead } from "../../ui/brand.js"
import { t } from "../../lib/i18n.js"

/** Небольшое окно-шпаргалка по Markdown в заметках. */
export function showMarkdownHelp() {
  const titleId = "note-md-help-title"
  const rows: [string, string][] = [
    [t("notes.md.help.h"), "# " + t("notes.md.help.hEx")],
    [t("notes.md.help.bold"), "**" + t("notes.md.help.boldEx") + "**"],
    [t("notes.md.help.italic"), "*" + t("notes.md.help.italicEx") + "*"],
    [t("notes.md.help.list"), "- " + t("notes.md.help.listEx")],
    [t("notes.md.help.link"), "[text](https://…)"],
    [t("notes.md.help.wiki"), "[[" + t("notes.md.help.wikiEx") + "]]"],
    [t("notes.md.help.tag"), "#tag"],
    [t("notes.md.help.image"), "![" + t("notes.md.help.imageAlt") + "](url)"],
    [t("notes.md.help.code"), "`code`"],
  ]

  const head = modalHead(t("notes.md.help.title"))
  const titleEl = head.querySelector(".modal-title")
  if (titleEl) titleEl.id = titleId

  const body = el("div", { class: "note-md-help" }, [
    el("p", { class: "muted" }, t("notes.md.help.intro")),
    el(
      "dl",
      { class: "note-md-help-list" },
      rows.flatMap(([label, sample]) => [
        el("dt", null, label),
        el("dd", null, el("code", null, sample)),
      ])
    ),
  ])

  let closeFn = () => {}
  const m = modal(
    el("div", null, [
      head,
      body,
      el("div", { class: "modal-actions" }, [
        el(
          "button",
          { class: "btn accent", type: "button", onclick: () => closeFn() },
          t("common.close")
        ),
      ]),
    ]),
    { labelledBy: titleId }
  )
  closeFn = () => m.close()
  return m
}
