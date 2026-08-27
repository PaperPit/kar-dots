import { store } from "../../core/state.js"
import { el, toast, modal, spinner } from "../../ui/ui.js"
import type { ModalHandle } from "../../ui/ui.js"
import { parseBulkLines, countReadyRows } from "../../lib/card-import.js"
import { getTranslateDir, translateBatch, sleep } from "../../lib/translate.js"
import { createTranslateDirToggle } from "../../ui/translate-dir-toggle.js"
import { route } from "../../core/router.js"
import { t } from "../../lib/i18n.js"

export function bulkCardDialog(folderId: string) {
  const textarea = el(
    "textarea",
    {
      class: "input bulk-textarea",
      rows: 12,
      placeholder: t("cardEditor.bulk.placeholder")
    },
    undefined
  )

  const translateMissingChk = el("input", { type: "checkbox", class: "chk" }, undefined)
  const { btn: dirToggleBtn, getDir: getTranslateDirLocal } =
    createTranslateDirToggle(getTranslateDir())

  function updatePreview() {
    const { rows, skipped, wordOnly } = parseBulkLines(textarea.value)
    const ready = countReadyRows(rows)
    const needTr = wordOnly.length
    let msg = t("cardEditor.bulk.readyCount", { ready })
    if (translateMissingChk.checked && needTr)
      msg += t("cardEditor.bulk.translateSuffix", { n: needTr })
    if (skipped) msg += t("cardEditor.bulk.skippedSuffix", { n: skipped })
    previewEl.textContent = msg
    addBtn.disabled = ready === 0 && !(translateMissingChk.checked && needTr)
  }

  textarea.addEventListener("input", updatePreview)
  translateMissingChk.addEventListener("change", updatePreview)

  async function submit() {
    const { rows } = parseBulkLines(textarea.value)
    const toCreate = rows.filter((r) => r.front && r.back)

    addBtn.disabled = true
    addBtn.innerHTML = ""
    addBtn.append(spinner(16))

    try {
      if (translateMissingChk.checked) {
        const words = rows.filter((r) => r.front && !r.back).map((r) => r.front)
        if (words.length) {
          previewEl.textContent = t("cardEditor.bulk.translating", { done: 0, total: words.length })
          const translated = await translateBatch(words, getTranslateDirLocal(), (done, total) => {
            previewEl.textContent = t("cardEditor.bulk.translating", { done, total })
          })
          for (const row of translated) {
            if (row.back) toCreate.push({ front: row.front, back: row.back })
          }
          await sleep(0)
        }
      }

      if (!toCreate.length) {
        toast(t("cardEditor.bulk.noneToAdd"), "error")
        return
      }

      let ok = 0
      for (const row of toCreate) {
        await store.createCard({
          folder_id: folderId,
          front: row.front,
          back: row.back,
          description: ""
        })
        ok++
      }
      m.close()
      await route()
      toast(t("cardEditor.bulk.addedCount", { n: ok }), "ok")
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error")
    } finally {
      addBtn.disabled = false
      addBtn.textContent = t("cardEditor.add")
      updatePreview()
    }
  }

  const previewEl = el(
    "p",
    { class: "bulk-preview muted" },
    t("cardEditor.bulk.readyCount", { ready: 0 })
  )
  const addBtn = el(
    "button",
    { class: "btn primary", onclick: submit, disabled: true },
    t("cardEditor.add")
  )

  const titleId = "bulk-card-dialog-title"
  const m: ModalHandle = modal(
    el("div", null, [
      el("h3", { class: "modal-title", id: titleId }, t("cardEditor.bulk.title")),
      el("p", { class: "modal-text" }, t("cardEditor.bulk.hint")),
      textarea,
      el("div", { class: "bulk-options" }, [
        el("label", { class: "bulk-option-row" }, [
          translateMissingChk,
          el("span", null, t("cardEditor.bulk.translateMissing"))
        ]),
        el("div", { class: "bulk-option-row" }, [
          el("span", { class: "bulk-option-lab" }, t("cardEditor.bulk.direction")),
          dirToggleBtn
        ])
      ]),
      previewEl,
      el("div", { class: "modal-actions" }, [
        el("button", { class: "btn ghost", onclick: () => m.close() }, t("common.cancel")),
        addBtn
      ])
    ]),
    { wide: true, sticky: true, labelledBy: titleId }
  )

  updatePreview()
  setTimeout(() => textarea.focus(), 260)
}
