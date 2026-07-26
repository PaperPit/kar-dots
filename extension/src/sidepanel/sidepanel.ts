// Первым — и намеренно первым: сторож ловит падения тел остальных модулей,
// которые иначе гасят окно молча. Порядок этого импорта менять нельзя.
import "./error-guard.js"
import {
  APP_ORIGIN,
  CONNECT_URL,
  MODES,
  type ImportMode
} from "../lib/constants.js"
import { getAuth, getPrefs, getVideo, setPrefs, setAuth } from "../lib/storage.js"
import { ExtSupabase } from "../lib/supabase-client.js"
import { listImportFolders, loadUserSettings, type ExtFolder } from "../lib/folders.js"
import {
  fetchTranscriptFromUrl,
  prepareTranscriptForMode,
  generateYoutubeCards
} from "../lib/yt-api.js"
import { loadKnownTermsForImport } from "../lib/known-terms.js"
import { createYoutubeCardsBatch } from "../lib/create-cards.js"
import {
  filterNewCandidates,
  filterNewSentences,
  fmtTimestamp,
  parseYouTubeId,
  type YtCandidate
} from "../../../js/lib/youtube-import.js"
import { hasSupadataApiKey, hasGenerateApiKey } from "../../../js/lib/youtube-import-settings.js"
import type { Settings } from "../../../js/data/types.js"

// #app всегда есть в index.html (там же лежит статическая заглушка), а если
// разметку однажды сломают — TypeError поймает error-guard и нарисует текст
// прямо в окне, поэтому отдельная проверка здесь ничего не добавляет.
const root = document.getElementById("app")!

// Ошибка вне boot() (обработчик кнопки, слушатель storage) тоже не должна
// оставлять пользователя один на один с пустой панелью.
window.addEventListener("unhandledrejection", (ev) => {
  renderFatal(ev.reason)
})
window.addEventListener("error", (ev) => {
  renderFatal(ev.error || ev.message)
})

interface PreviewItem {
  cand: YtCandidate
  checked: boolean
  back: string
}

let cancelled = false
let mode: ImportMode = "both"
let mergeCues = true
let folderId: string | null = null
let folders: ExtFolder[] = []
let settings: Settings | null = null
let videoUrl = ""
let videoTitle = ""
let previewItems: PreviewItem[] = []
let videoId: string | null = null
let accountEmail: string | null = null

/**
 * Атрибуты и дети приходят и как null — например `el("h1", null, "…")`.
 * Значение по умолчанию у параметра подставляется только вместо undefined, так
 * что на явный null `Object.entries` бросал «Cannot convert undefined or null
 * to object». Падало это внутри brand(), а brand() зовётся в каждом рендере —
 * поэтому окно расширения открывалось пустым вообще всегда.
 */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, unknown> | null,
  children?: Array<Node | string | null | false | undefined> | string | null
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k === "class") node.className = String(v)
    else if (k === "onclick" && typeof v === "function") node.addEventListener("click", v as EventListener)
    else if (k === "onchange" && typeof v === "function") node.addEventListener("change", v as EventListener)
    else if (k === "checked") (node as HTMLInputElement).checked = !!v
    else if (k === "disabled") (node as HTMLButtonElement).disabled = !!v
    else if (k === "value") (node as HTMLInputElement | HTMLSelectElement).value = String(v ?? "")
    else if (k === "selected") {
      if (v) (node as HTMLOptionElement).selected = true
    } else if (v != null && v !== false) node.setAttribute(k, String(v))
  }
  const kids = Array.isArray(children) ? children : children == null ? [] : [children]
  for (const c of kids) {
    if (c == null || c === false) continue
    node.append(typeof c === "string" ? document.createTextNode(c) : c)
  }
  return node
}

function brand() {
  return el("div", { class: "brand" }, [
    el("div", { class: "brand-mark" }, "К"),
    el("div", null, [el("h1", null, "КАР-точки"), el("p", null, "Карточки из YouTube")])
  ])
}

// Не знать текущее видео — не повод не показывать панель: пользователь всё
// равно может войти в аккаунт и выбрать папку. Поэтому оба источника опрашиваем
// по отдельности и ошибку каждого проглатываем.
async function refreshVideoFromStorage() {
  try {
    const v = await getVideo()
    if (v?.url) {
      videoUrl = v.url
      videoTitle = v.title || videoTitle
    }
  } catch {
    /* chrome.storage.session недоступен — не критично */
  }
  if (videoUrl) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab?.url && /youtube\.com\/(watch|shorts)/.test(tab.url)) {
      videoUrl = tab.url
      videoTitle = (tab.title || "").replace(/ - YouTube$/, "")
    }
  } catch {
    /* нет доступа к вкладке — пользователь вставит ссылку, открыв ролик заново */
  }
}

/**
 * Последний рубеж: что бы ни упало на старте, пользователь должен увидеть текст,
 * а не пустую панель. Раньше начало boot() лежало вне try/catch и вызывалось как
 * `void boot()`, поэтому любая ошибка в chrome.storage/chrome.tabs просто гасила
 * панель — снаружи это выглядело как «расширение не открывается».
 */
function renderFatal(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  root.replaceChildren(
    brand(),
    el("div", { class: "card" }, [
      el("p", { class: "error" }, "Окно не смогло запуститься: " + msg),
      el(
        "p",
        { class: "muted" },
        "Если это повторяется — правый клик по окну → «Просмотреть код» и пришли текст из вкладки Console."
      ),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", onclick: () => void boot() }, "Попробовать снова")
      ])
    ])
  )
}

async function boot() {
  try {
    await bootInner()
  } catch (e) {
    renderFatal(e)
  }
}

async function bootInner() {
  const prefs = await getPrefs()
  mode = prefs.mode
  mergeCues = prefs.mergeCues
  folderId = prefs.folderId
  await refreshVideoFromStorage()

  const auth = await getAuth()
  if (!auth) {
    renderAuth()
    return
  }

  try {
    const sb = await ExtSupabase.fromStorage()
    if (!sb || !(await sb.ensureFresh())) {
      await setAuth(null)
      renderAuth("Сессия истекла — подключите аккаунт снова")
      return
    }
    accountEmail = sb.email()
    folders = await listImportFolders(sb)
    settings = await loadUserSettings(sb)
    if (folderId && !folders.some((f) => f.id === folderId)) folderId = null
    if (!folderId && folders[0]) {
      folderId = folders[0].id
      await setPrefs({ folderId })
    }
    renderForm()
  } catch (e) {
    renderAuth(e instanceof Error ? e.message : String(e))
  }
}

function renderAuth(error?: string) {
  root.replaceChildren(
    brand(),
    el("div", { class: "card auth-box" }, [
      el(
        "p",
        null,
        "Чтобы сохранять карточки в свою коллекцию, подключи аккаунт на kar-tochki.pages.dev."
      ),
      error ? el("p", { class: "error" }, error) : null,
      el("div", { class: "actions", style: "justify-content:center" }, [
        el(
          "button",
          {
            class: "btn primary",
            onclick: () => {
              chrome.tabs.create({ url: CONNECT_URL })
            }
          },
          "Войти через КАР-точки"
        )
      ]),
      el(
        "p",
        { class: "muted" },
        "Откроется сайт — войди, если ещё не вошёл. Расширение получит сессию автоматически."
      )
    ])
  )
}

function accountBar() {
  return el("div", { class: "account-row" }, [
    el("span", null, accountEmail ? `Аккаунт: ${accountEmail}` : "Аккаунт подключён"),
    el(
      "button",
      {
        class: "btn linkish",
        onclick: async () => {
          await setAuth(null)
          accountEmail = null
          renderAuth()
        }
      },
      "Отключить"
    )
  ])
}

function renderForm(error = "") {
  const modeSeg = el("div", { class: "seg" }, [])
  for (const mo of MODES) {
    modeSeg.append(
      el(
        "button",
        {
          type: "button",
          class: mo.id === mode ? "active" : "",
          onclick: () => {
            if (mode === mo.id) return
            mode = mo.id
            void setPrefs({ mode }).then(() => renderForm(error))
          }
        },
        mo.label
      )
    )
  }

  const mergeChk = el("input", {
    type: "checkbox",
    checked: mergeCues,
    onchange: () => {
      mergeCues = mergeChk.checked
      void setPrefs({ mergeCues })
    }
  }) as HTMLInputElement

  const sentencesOpts = el("div", { class: "field" }, [
    el("label", { class: "check-label" }, [
      mergeChk,
      el("span", null, "Склеивать короткие реплики в предложения")
    ])
  ])
  sentencesOpts.style.display = mode === "sentences" ? "" : "none"

  const folderSelect = el("select", { class: "input" }, []) as HTMLSelectElement
  if (!folders.length) {
    folderSelect.append(el("option", { value: "" }, "Нет папок — создай в приложении"))
  } else {
    for (const f of folders) {
      folderSelect.append(el("option", { value: f.id, selected: f.id === folderId }, f.name))
    }
  }
  folderSelect.addEventListener("change", () => {
    folderId = folderSelect.value || null
    void setPrefs({ folderId })
  })

  const errEl = el("p", { class: "error" }, error)
  errEl.style.display = error ? "" : "none"

  const goBtn = el(
    "button",
    {
      class: "btn primary",
      disabled: !folders.length || !videoUrl,
      onclick: () => void runImport()
    },
    "Сформировать"
  ) as HTMLButtonElement

  root.replaceChildren(
    brand(),
    accountBar(),
    el("div", { class: "card" }, [
      el("p", { class: "video-title" }, videoTitle || "Текущее видео"),
      el("p", { class: "video-url" }, videoUrl || "Открой ролик на YouTube"),
      el("div", { class: "field" }, [el("label", null, "Что достать из ролика"), modeSeg]),
      sentencesOpts,
      el("div", { class: "field" }, [el("label", null, "Папка"), folderSelect]),
      errEl,
      el("div", { class: "actions" }, [goBtn])
    ])
  )
}

function renderProgress(text: string) {
  const statusEl = el("p", null, text)
  root.replaceChildren(
    brand(),
    el("div", { class: "card status-wrap" }, [
      el("div", { class: "spinner" }),
      statusEl,
      el(
        "button",
        {
          class: "btn ghost",
          onclick: () => {
            cancelled = true
            renderForm()
          }
        },
        "Отмена"
      )
    ])
  )
  return (t: string) => {
    statusEl.textContent = t
  }
}

async function runImport() {
  cancelled = false

  if (!videoUrl || !parseYouTubeId(videoUrl)) {
    renderForm("Не похоже на ссылку на YouTube-видео — открой ролик на YouTube")
    return
  }
  if (!folderId) {
    renderForm("Выбери папку")
    return
  }
  if (!hasSupadataApiKey(settings)) {
    renderForm(
      "Укажи Supadata API ключ в КАР-точки: Настройки → «Карточки из YouTube» → «Настроить»"
    )
    return
  }
  if (!hasGenerateApiKey(settings)) {
    renderForm(
      "Укажи Gemini или Groq API ключ в КАР-точки: Настройки → «Карточки из YouTube» → «Настроить»"
    )
    return
  }

  const setStatus = renderProgress("Получаю данные видео…")
  const isClosed = () => cancelled

  try {
    const sb = await ExtSupabase.fromStorage()
    if (!sb) throw new Error("Нет сессии")

    const { video, transcript } = await fetchTranscriptFromUrl(videoUrl, settings, {
      isClosed,
      onStatus: setStatus
    })
    if (cancelled) return

    videoId = video.videoId || parseYouTubeId(videoUrl)
    if (video.title) videoTitle = String(video.title)

    setStatus("Составляю карточки…")
    const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues })
    const gen = await generateYoutubeCards(
      { video, transcript: prepared, mode, settings },
      { isClosed }
    )
    if (cancelled) return

    setStatus(mode === "sentences" ? "Проверяю новые предложения…" : "Проверяю новые слова…")
    const known = await loadKnownTermsForImport(sb, folders, folderId)
    if (cancelled) return

    if (mode === "sentences") {
      previewItems = filterNewSentences(gen.cards || [], known).map((cand) => ({
        cand,
        checked: true,
        back: cand.back || ""
      }))
    } else {
      const { phrases, words } = filterNewCandidates(gen.cards || [], known)
      const list =
        mode === "words" ? words : mode === "phrases" ? phrases : [...phrases, ...words]
      previewItems = list.map((cand) => ({
        cand,
        checked: true,
        back: cand.back || ""
      }))
    }

    if (!previewItems.length) {
      renderForm("Новых карточек не нашлось — всё уже есть в паках или папках")
      return
    }
    renderPreview()
  } catch (e) {
    if (cancelled) return
    renderForm(e instanceof Error ? e.message : String(e))
  }
}

function renderPreview() {
  const groups = new Map<string, PreviewItem[]>()
  for (const item of previewItems) {
    const kind =
      item.cand.kind === "sentence"
        ? "Предложения"
        : item.cand.kind === "phrase"
          ? "Фразы"
          : "Слова"
    if (!groups.has(kind)) groups.set(kind, [])
    groups.get(kind)!.push(item)
  }

  const selectedCount = () => previewItems.filter((i) => i.checked && i.back.trim()).length
  const countLabel = el("span", { class: "muted" }, `Выбрано: ${selectedCount()}`)
  const toast = el("div", { class: "toast" }, "")
  toast.style.display = "none"

  const list = el("div", null, [])
  for (const [title, items] of groups) {
    const groupEl = el("div", { class: "preview-group" }, [el("h3", null, `${title} (${items.length})`)])
    for (const item of items) {
      const chk = el("input", { type: "checkbox", checked: item.checked }) as HTMLInputElement
      chk.addEventListener("change", () => {
        item.checked = chk.checked
        countLabel.textContent = `Выбрано: ${selectedCount()}`
        saveBtn.disabled = selectedCount() === 0
      })
      const back = el("input", { class: "back", value: item.back }) as HTMLInputElement
      back.addEventListener("input", () => {
        item.back = back.value
        countLabel.textContent = `Выбрано: ${selectedCount()}`
        saveBtn.disabled = selectedCount() === 0
      })
      const metaParts = [
        item.cand.level,
        item.cand.pos || item.cand.kind,
        item.cand.t != null ? fmtTimestamp(item.cand.t) : null
      ].filter(Boolean)
      groupEl.append(
        el("div", { class: "preview-row" }, [
          chk,
          el("div", null, [
            el("div", { class: "front" }, item.cand.front || ""),
            metaParts.length ? el("div", { class: "meta" }, metaParts.join(" · ")) : null,
            back
          ])
        ])
      )
    }
    list.append(groupEl)
  }

  const saveBtn = el(
    "button",
    {
      class: "btn primary",
      disabled: selectedCount() === 0,
      onclick: () => void saveSelected(saveBtn, toast, countLabel)
    },
    "Создать карточки"
  ) as HTMLButtonElement

  root.replaceChildren(
    brand(),
    el("div", { class: "card" }, [
      el("div", { class: "preview-head" }, [
        el("div", null, [
          el("p", { class: "video-title" }, videoTitle || "Превью"),
          el("p", { class: "muted" }, "Отметь, что сохранить, при необходимости поправь перевод")
        ]),
        countLabel
      ]),
      list,
      toast,
      el("div", { class: "actions" }, [
        el("button", { class: "btn ghost", onclick: () => renderForm() }, "Назад"),
        saveBtn
      ])
    ])
  )
}

async function saveSelected(
  saveBtn: HTMLButtonElement,
  toast: HTMLElement,
  countLabel: HTMLElement
) {
  const selected = previewItems
    .filter((i) => i.checked && i.back.trim())
    .map((i) => ({ cand: i.cand, back: i.back.trim() }))
  if (!selected.length || !folderId) return

  saveBtn.disabled = true
  toast.style.display = "none"
  try {
    const sb = await ExtSupabase.fromStorage()
    if (!sb) throw new Error("Нет сессии")
    const { ok, failed } = await createYoutubeCardsBatch(sb, folderId, selected, videoId)
    const folder = folders.find((f) => f.id === folderId)
    toast.className = failed.length && !ok ? "toast error" : "toast"
    toast.style.display = ""
    toast.textContent =
      ok > 0
        ? `Создано: ${ok}` + (failed.length ? `, ошибок: ${failed.length}` : "")
        : `Не удалось сохранить (${failed[0]?.message || "ошибка"})`
    if (ok > 0) {
      toast.append(
        el("br"),
        el(
          "a",
          {
            href: `${APP_ORIGIN}/#/folder/${folderId}`,
            target: "_blank",
            rel: "noopener noreferrer",
            style: "display:inline-block;margin-top:8px;color:inherit;font-weight:700"
          },
          folder ? `Открыть «${folder.name}»` : "Открыть папку"
        )
      )
    }
    countLabel.textContent = `Создано: ${ok}`
  } catch (e) {
    toast.className = "toast error"
    toast.style.display = ""
    toast.textContent = e instanceof Error ? e.message : String(e)
    saveBtn.disabled = false
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.kar_ext_auth) void boot()
  if (area === "session" && changes.kar_ext_video) {
    const v = changes.kar_ext_video.newValue as { url?: string; title?: string } | undefined
    if (v?.url) {
      videoUrl = v.url
      if (v.title) videoTitle = v.title
      const urlEl = root.querySelector(".video-url")
      const titleEl = root.querySelector(".video-title")
      if (urlEl) urlEl.textContent = videoUrl
      if (titleEl && videoTitle) titleEl.textContent = videoTitle
    }
  }
})

void boot()
