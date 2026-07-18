import { el, toast, modal, confirmDialog, plural, spinner, ModalHandle } from "./ui.js"
import { Folder } from "./types.js"
import { store } from "../core/state.js"
import { route } from "../core/router.js"
import { fetchPackManifest, fetchVocabPack } from "../lib/vocab-packs.js"
import { crowTombIcon } from "./helpers.js"
import { nav } from "./shell.js"

interface VocabPackMeta {
  id: string
  title: string
  subtitle?: string
  level?: string
  color?: string
  cardCount?: number
  file?: string
  [key: string]: unknown
}

interface VocabPackManifest {
  packs: VocabPackMeta[]
}

interface InstallOverlay {
  setDownload: () => void
  setImport: (total: number) => void
  onProgress: (p: { done: number; total: number }) => void
  finish: () => Promise<void>
  remove: () => void
}

function packInstallOverlay(modalBox: HTMLElement, meta: VocabPackMeta): InstallOverlay {
  const barFill = el("div", null)
  const bar = el("div", { class: "progress vocab-pack-install-bar is-indeterminate" }, barFill)
  const statusEl = el("p", { class: "vocab-pack-install-status" }, "Загрузка пака…")
  const detailEl = el("p", { class: "vocab-pack-install-detail muted" }, "")
  const pctEl = el("span", { class: "vocab-pack-install-pct tnum" }, "")

  const panel = el("div", { class: "vocab-pack-install-panel" }, [
    el("div", { class: "vocab-pack-install-spin" }, spinner(40)),
    el("strong", { class: "vocab-pack-install-title" }, meta.title),
    el("p", { class: "vocab-pack-install-level muted" }, meta.subtitle || meta.level),
    statusEl,
    bar,
    el("div", { class: "vocab-pack-install-meta" }, [pctEl, detailEl])
  ])

  const overlay = el("div", { class: "vocab-pack-install-overlay" }, panel)
  modalBox.classList.add("has-pack-install")
  modalBox.append(overlay)

  function setPct(pct: number) {
    barFill.style.width = Math.min(100, Math.max(0, pct)) + "%"
    pctEl.textContent = pct > 0 ? Math.round(pct) + "%" : ""
  }

  return {
    setDownload() {
      bar.classList.add("is-indeterminate")
      statusEl.textContent = "Загрузка пака…"
      detailEl.textContent =
        plural(meta.cardCount ?? 0, "карточка", "карточки", "карточек") + " · подождите"
      setPct(0)
    },
    setImport(total) {
      bar.classList.remove("is-indeterminate")
      statusEl.textContent = "Добавление карточек…"
      detailEl.textContent = `0 / ${total}`
      setPct(2)
    },
    onProgress({ done, total }: { done: number; total: number }) {
      const pct = total ? (done / total) * 100 : 0
      setPct(pct)
      detailEl.textContent = `${done} / ${total} ${plural(total, "карточка", "карточки", "карточек")}`
    },
    async finish() {
      bar.classList.remove("is-indeterminate")
      statusEl.textContent = "Готово!"
      detailEl.textContent = "Пак установлен"
      setPct(100)
      panel.classList.add("is-done")
      await new Promise((r) => setTimeout(r, 420))
    },
    remove() {
      overlay.remove()
      modalBox.classList.remove("has-pack-install")
    }
  }
}

export async function vocabPacksDialog(): Promise<void> {
  let m: ModalHandle
  let manifest: VocabPackManifest
  try {
    manifest = await fetchPackManifest()
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), "error")
    return
  }

  let installing = false
  const list = el("div", { class: "vocab-pack-list" })
  const closeBtn = el("button", { type: "button", class: "btn ghost" }, "Закрыть")

  function renderList() {
    list.innerHTML = ""
    for (const meta of manifest.packs) {
      const installed = store.findFolderByPackId(meta.id)
      const status = installed
        ? el("span", { class: "vocab-pack-status is-installed" }, "Установлен")
        : el("span", { class: "vocab-pack-status" }, "Не установлен")

      const actions = el("div", { class: "vocab-pack-actions" })

      if (installed) {
        actions.append(
          el(
            "button",
            {
              type: "button",
              class: "btn",
              disabled: installing,
              onclick: () => {
                m.close()
                nav("#folder/" + installed.id)
              }
            },
            "Открыть"
          ),
          el(
            "button",
            {
              type: "button",
              class: "btn ghost danger-text",
              disabled: installing,
              onclick: () => removePack(meta, installed)
            },
            "Удалить пак"
          )
        )
      } else {
        const installBtn = el(
          "button",
          {
            type: "button",
            class: "btn primary",
            disabled: installing
          },
          "Установить"
        )
        installBtn.addEventListener("click", () => installPack(meta))
        actions.append(installBtn)
      }

      list.append(
        el("div", { class: "vocab-pack-item" }, [
          el(
            "div",
            {
              class: "vocab-pack-swatch",
              style: { background: meta.color || "#7C8DB5" }
            },
            meta.level
          ),
          el("div", { class: "vocab-pack-info" }, [
            el("div", { class: "vocab-pack-title-row" }, [
              el("strong", { class: "vocab-pack-title" }, meta.title),
              status
            ]),
            el("p", { class: "vocab-pack-sub" }, meta.subtitle),
            el("p", { class: "vocab-pack-meta muted" }, [
              meta.cardCount ?? 0,
              " ",
              plural(meta.cardCount ?? 0, "карточка", "карточки", "карточек")
            ])
          ]),
          actions
        ])
      )
    }
  }

  async function installPack(meta: VocabPackMeta): Promise<void> {
    if (installing) return
    installing = true
    closeBtn.disabled = true
    renderList()

    const modalBox = list.closest(".modal-box") as HTMLElement
    const overlay = packInstallOverlay(modalBox, meta)
    overlay.setDownload()

    try {
      const pack = await fetchVocabPack(meta.id)
      const total = pack.cards.filter((c: { front?: string }) => c.front?.trim()).length
      overlay.setImport(total)
      const folder = await store.importVocabPack(pack, (p: { done: number; total: number }) => overlay.onProgress(p))
      await overlay.finish()
      overlay.remove()
      toast(`Пак «${meta.title}» установлен`, "ok")
      m.close()
      nav("#folder/" + folder.id)
    } catch (e) {
      overlay.remove()
      toast(e instanceof Error ? e.message : String(e), "error")
      installing = false
      closeBtn.disabled = false
      renderList()
    }
  }

  async function removePack(meta: VocabPackMeta, folder: Folder): Promise<void> {
    const n = await store.countCards(folder.id)
    const yes = await confirmDialog(
      "Удалить лексический пак?",
      `«${meta.title}» и все ${n} ${plural(n, "карточка", "карточки", "карточек")} будут удалены.`,
      "Удалить пак",
      true,
      crowTombIcon()
    )
    if (!yes) return
    try {
      await store.deleteVocabPack(meta.id)
      toast("Пак удалён", "ok")
      renderList()
      await route()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error")
    }
  }

  renderList()
  closeBtn.addEventListener("click", () => {
    if (!installing) m.close()
  })

  m = modal(
    el("div", null, [
      el("h3", { class: "modal-title" }, "Лексические паки"),
      el(
        "p",
        { class: "modal-text" },
        "Готовые наборы слов по уровням CEFR. У каждого слова может быть несколько правильных переводов. Если пак уже установлен — удалите и установите заново для обновления."
      ),
      list,
      el("div", { class: "modal-actions" }, [closeBtn])
    ])
  )
}
