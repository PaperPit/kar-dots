// Первым — и намеренно первым: сторож ловит падения тел остальных модулей.
import "./error-guard.js"
import {
  APP_ORIGIN,
  CONNECT_URL,
  MODES,
  type ImportMode
} from "../lib/constants.js"
import { detectExtLocale, modeLabel, setExtLocale, t } from "../lib/i18n.js"
import { getPrefs, getVideo, setPrefs } from "../lib/storage.js"
import { defaultExportFolder, settingsFromPrefs } from "../lib/folders.js"
import {
  fetchTranscriptFromUrl,
  prepareTranscriptForMode,
  generateYoutubeCards
} from "../lib/yt-api.js"
import { loadKnownTermsForImport } from "../lib/known-terms.js"
import { buildImportPayload, downloadTextFile } from "../lib/create-cards.js"
import {
  filterNewCandidates,
  filterNewSentences,
  parseYouTubeId,
  type YtCandidate
} from "../../../js/lib/youtube-import.js"
import { hasSupadataApiKey, hasGenerateApiKey } from "../../../js/lib/youtube-import-settings.js"
import type { Settings } from "../../../js/data/types.js"

const root = document.getElementById("app")!

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
let folderName = "YouTube"
let settings: Settings | null = null
let videoUrl = ""
let videoTitle = ""
let previewItems: PreviewItem[] = []
let videoId: string | null = null

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
    el("div", null, [el("h1", null, t("brand.title")), el("p", null, t("brand.sub"))])
  ])
}

async function refreshVideoFromStorage() {
  try {
    const v = await getVideo()
    if (v?.url) {
      videoUrl = v.url
      videoTitle = v.title || videoTitle
    }
  } catch {
    /* ignore */
  }
  if (videoUrl) return
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (tab?.url && /youtube\.com\/(watch|shorts)/.test(tab.url)) {
      videoUrl = tab.url
      videoTitle = (tab.title || "").replace(/ - YouTube$/, "")
    }
  } catch {
    /* ignore */
  }
}

function renderFatal(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  root.replaceChildren(
    brand(),
    el("div", { class: "card" }, [
      el("p", { class: "error" }, t("fatal.title", { message: msg })),
      el("p", { class: "muted" }, t("fatal.hint")),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", onclick: () => void boot() }, t("fatal.retry"))
      ])
    ])
  )
}

async function boot() {
  try {
    setExtLocale(detectExtLocale())
    await bootInner()
  } catch (e) {
    renderFatal(e)
  }
}

async function bootInner() {
  const prefs = await getPrefs()
  mode = prefs.mode
  mergeCues = prefs.mergeCues
  folderName = prefs.folderName || "YouTube"
  settings = settingsFromPrefs(prefs)
  await refreshVideoFromStorage()
  renderForm()
}

function hintBar() {
  return el("div", { class: "account-row" }, [
    el("span", null, t("account.localOnly")),
    el(
      "button",
      {
        class: "btn linkish",
        onclick: () => chrome.tabs.create({ url: CONNECT_URL })
      },
      t("account.openApp")
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
        modeLabel(mo.id)
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
    el("label", { class: "check-label" }, [mergeChk, el("span", null, t("form.mergeCues"))])
  ])
  sentencesOpts.style.display = mode === "sentences" ? "" : "none"

  const folderInput = el("input", {
    class: "input",
    type: "text",
    value: folderName,
    onchange: () => {
      folderName = folderInput.value.trim() || "YouTube"
      void setPrefs({ folderName })
    }
  }) as HTMLInputElement

  const keySupadata = el("input", {
    class: "input",
    type: "password",
    value: settings?.supadataApiKey || "",
    placeholder: "Supadata",
    onchange: async () => {
      await setPrefs({ supadataApiKey: keySupadata.value.trim() })
      settings = settingsFromPrefs(await getPrefs())
    }
  }) as HTMLInputElement

  const keyGemini = el("input", {
    class: "input",
    type: "password",
    value: settings?.geminiApiKey || "",
    placeholder: "Gemini",
    onchange: async () => {
      await setPrefs({ geminiApiKey: keyGemini.value.trim() })
      settings = settingsFromPrefs(await getPrefs())
    }
  }) as HTMLInputElement

  const keyGroq = el("input", {
    class: "input",
    type: "password",
    value: settings?.groqApiKey || "",
    placeholder: "Groq",
    onchange: async () => {
      await setPrefs({ groqApiKey: keyGroq.value.trim() })
      settings = settingsFromPrefs(await getPrefs())
    }
  }) as HTMLInputElement

  const errEl = el("p", { class: "error" }, error)
  errEl.style.display = error ? "" : "none"

  const goBtn = el(
    "button",
    {
      class: "btn primary",
      disabled: !videoUrl,
      onclick: () => void runImport()
    },
    t("form.generate")
  ) as HTMLButtonElement

  root.replaceChildren(
    brand(),
    hintBar(),
    el("div", { class: "card" }, [
      el("p", { class: "video-title" }, videoTitle || t("form.videoFallback")),
      el("p", { class: "video-url" }, videoUrl || t("form.urlFallback")),
      el("div", { class: "field" }, [el("label", null, t("form.whatLabel")), modeSeg]),
      sentencesOpts,
      el("div", { class: "field" }, [el("label", null, t("form.folderLabel")), folderInput]),
      el("div", { class: "field" }, [el("label", null, t("form.keysLabel")), keySupadata, keyGemini, keyGroq]),
      el("p", { class: "muted" }, t("form.exportHint")),
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
        t("progress.cancel")
      )
    ])
  )
  return (next: string) => {
    statusEl.textContent = next
  }
}

async function runImport() {
  cancelled = false

  if (!videoUrl || !parseYouTubeId(videoUrl)) {
    renderForm(t("form.badUrl"))
    return
  }
  folderName = folderName.trim() || "YouTube"
  if (!hasSupadataApiKey(settings)) {
    renderForm(t("form.needSupadata"))
    return
  }
  if (!hasGenerateApiKey(settings)) {
    renderForm(t("form.needLlm"))
    return
  }

  const setStatus = renderProgress(t("progress.fetchVideo"))

  try {
    const { video, transcript } = await fetchTranscriptFromUrl(videoUrl, settings, {
      isClosed: () => cancelled,
      onStatus: setStatus
    })
    if (cancelled) return

    videoId = video.videoId || parseYouTubeId(videoUrl)
    if (video.title) videoTitle = String(video.title)

    setStatus(t("progress.generate"))
    const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues })
    const gen = await generateYoutubeCards(
      { video, transcript: prepared, mode, settings },
      { isClosed: () => cancelled }
    )
    if (cancelled) return

    setStatus(mode === "sentences" ? t("progress.checkSentences") : t("progress.checkWords"))
    const known = await loadKnownTermsForImport()
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
      renderForm(t("form.empty"))
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
        ? t("preview.group.sentences")
        : item.cand.kind === "phrase"
          ? t("preview.group.phrases")
          : t("preview.group.words")
    if (!groups.has(kind)) groups.set(kind, [])
    groups.get(kind)!.push(item)
  }

  const list = el("div", { class: "preview-list" }, [])
  for (const [label, items] of groups) {
    list.append(el("h3", null, label))
    for (const item of items) {
      const chk = el("input", {
        type: "checkbox",
        checked: item.checked,
        onchange: () => {
          item.checked = chk.checked
          countLabel.textContent = t("preview.selected", {
            n: previewItems.filter((i) => i.checked).length
          })
        }
      }) as HTMLInputElement
      const back = el("input", {
        class: "input",
        type: "text",
        value: item.back,
        onchange: () => {
          item.back = back.value
        }
      }) as HTMLInputElement
      list.append(
        el("div", { class: "preview-row" }, [
          chk,
          el("div", null, [el("b", null, item.cand.front || ""), back])
        ])
      )
    }
  }

  const countLabel = el(
    "span",
    null,
    t("preview.selected", { n: previewItems.filter((i) => i.checked).length })
  )
  const toast = el("p", { class: "toast", style: "display:none" }, "")
  const saveBtn = el(
    "button",
    {
      class: "btn primary",
      onclick: () => void saveSelected(saveBtn, toast, countLabel)
    },
    t("preview.create")
  ) as HTMLButtonElement

  root.replaceChildren(
    brand(),
    el("div", { class: "card" }, [
      el("div", { class: "preview-head" }, [
        el("div", null, [
          el("p", { class: "video-title" }, videoTitle || t("preview.title")),
          el("p", { class: "muted" }, t("preview.hint"))
        ]),
        countLabel
      ]),
      list,
      toast,
      el("div", { class: "actions" }, [
        el("button", { class: "btn ghost", onclick: () => renderForm() }, t("preview.back")),
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
  if (!selected.length) return

  saveBtn.disabled = true
  toast.style.display = "none"
  try {
    const { ok, json } = buildImportPayload(folderName || defaultExportFolder().name, selected, videoId)
    downloadTextFile(`kar-youtube-${Date.now()}.json`, json)
    toast.className = "toast"
    toast.style.display = ""
    toast.textContent = t("save.exported", { ok })
    toast.append(
      el("br"),
      el(
        "a",
        {
          href: `${APP_ORIGIN}/#settings`,
          target: "_blank",
          rel: "noopener noreferrer",
          style: "display:inline-block;margin-top:8px;color:inherit;font-weight:700"
        },
        t("save.openImport")
      )
    )
    countLabel.textContent = t("save.exported", { ok })
  } catch (e) {
    toast.className = "toast error"
    toast.style.display = ""
    toast.textContent = e instanceof Error ? e.message : String(e)
    saveBtn.disabled = false
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
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
