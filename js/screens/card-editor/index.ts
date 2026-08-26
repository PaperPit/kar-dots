import { el, toast, modal } from "../../ui/ui.js"
import type { ModalHandle } from "../../ui/ui.js"
import { featherIcon } from "../../ui/helpers.js"
import { getTranslateDir, translateText } from "../../lib/translate.js"
import { createTranslateDirToggle } from "../../ui/translate-dir-toggle.js"
import { t } from "../../lib/i18n.js"
import { buildCardEditorForm } from "./form.js"
import { saveCard, deleteCardAction } from "./actions.js"
import { openCardPreview } from "./card-preview.js"
import type { Card } from "../../data/types.js"

interface CardDialogOpts {
  review?: boolean
  fromLesson?: boolean
  onSaved?: (patch: Record<string, unknown>) => void
  onDeleted?: () => void
  [key: string]: unknown
}

export function cardDialog(folderId: string, card?: Card | null, opts: CardDialogOpts = {}) {
  const isEditing = !!card
  const fromLesson = !!(opts.review || opts.fromLesson || opts.onSaved || opts.onDeleted)
  const titleId = "card-dialog-title"
  const state = {
    front_img: card ? card.front_img : null,
    back_img: card ? card.back_img : null
  }

  let saveMoreBtn: HTMLButtonElement | null = null
  const { btn: dirToggleBtn, getDir: getTranslateDirLocal } =
    createTranslateDirToggle(getTranslateDir())

  const translateBtn = el(
    "button",
    { type: "button", class: "btn translate-btn" },
    t("cardEditor.translate")
  )
  const translateRow = el("div", { class: "translate-row" }, [dirToggleBtn, translateBtn])

  const { body, frontRich, defRich, descRich } = buildCardEditorForm(
    card ?? null,
    state,
    translateRow
  )

  translateBtn.addEventListener("click", async () => {
    const src = frontRich.getPlain()
    if (!src) {
      toast(t("cardEditor.translate.needFront"), "error")
      return
    }
    if (card && !defRich.isEmpty()) {
      if (!window.confirm(t("cardEditor.translate.confirmReplace"))) return
    }
    translateBtn.disabled = true
    const prev = translateBtn.textContent
    translateBtn.textContent = "…"
    try {
      const out = await translateText(src, getTranslateDirLocal())
      defRich.setPlain(out)
      toast(t("cardEditor.translate.done"), "ok")
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error")
    } finally {
      translateBtn.disabled = false
      translateBtn.textContent = prev
    }
  })

  function openNewDialog() {
    cardDialog(folderId)
  }

  async function submit(andContinue: boolean) {
    await saveCard({
      folderId,
      card: card ?? null,
      state,
      frontRich,
      defRich,
      descRich,
      fromLesson,
      opts,
      m,
      andContinue,
      saveBtn,
      saveMoreBtn,
      openNewDialog
    })
  }

  const saveBtn = el(
    "button",
    {
      type: "button",
      class: "btn primary",
      onclick: () => submit(false)
    },
    isEditing ? t("common.save") : t("cardEditor.add")
  )

  if (!isEditing && !fromLesson) {
    saveMoreBtn = el(
      "button",
      {
        type: "button",
        class: "btn btn-save-more",
        title: t("cardEditor.saveMore.title"),
        onclick: () => submit(true)
      },
      [
        el("span", { class: "btn-save-more-short" }, t("cardEditor.saveMore.short")),
        el("span", { class: "btn-save-more-full" }, t("cardEditor.saveMore.full"))
      ]
    )
  }

  const deleteBtn =
    isEditing && fromLesson
      ? el(
          "button",
          {
            type: "button",
            class: "btn danger modal-delete-btn",
            onclick: () => deleteCardAction(card ?? null, opts, m)
          },
          t("common.delete")
        )
      : null

  const previewBtn = el(
    "button",
    {
      type: "button",
      class: "btn card-preview-btn",
      onclick: () => openCardPreview({ frontRich, defRich, descRich, state })
    },
    t("cardEditor.preview")
  )

  const actionBtnsEnd = [
    el(
      "button",
      { type: "button", class: "btn secondary", onclick: () => m.close() },
      t("common.cancel")
    )
  ]
  if (saveMoreBtn) actionBtnsEnd.push(saveMoreBtn)
  actionBtnsEnd.push(saveBtn)

  const actionsRow = el("div", { class: "modal-actions modal-actions-split card-editor-actions" }, [
    previewBtn,
    el("div", { class: "modal-actions-end" }, actionBtnsEnd)
  ])

  const header = isEditing
    ? el(
        "div",
        { class: "modal-head modal-head-toolbar" },
        [
          el("div", { class: "modal-head-left" }, [
            featherIcon("modal-head-icon"),
            el("h3", { class: "modal-title", id: titleId }, t("cardEditor.title.edit"))
          ]),
          deleteBtn
        ].filter(Boolean)
      )
    : el("h3", { class: "modal-title", id: titleId }, t("cardEditor.title.new"))

  const m: ModalHandle = modal(el("div", null, [header, body, actionsRow]), {
    wide: true,
    sticky: fromLesson,
    labelledBy: titleId,
    // Три rich-редактора вешают слушатель на document — снимаем при закрытии.
    onClose: () => {
      frontRich.destroy()
      defRich.destroy()
      descRich.destroy()
    }
  })

  if (!isEditing) setTimeout(() => frontRich.focus(), 260)
}
