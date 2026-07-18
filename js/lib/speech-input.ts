import { detectSpeechLang } from "./web-speech-tts.js"
import type {
  NativeSpeechEvent,
  NativeSpeechHandle,
  NativeSpeechRecognition as NativeSpeechRecognitionType
} from "../vendor/capacitor-speech-recognition.mjs"

let nativePlugin: NativeSpeechRecognitionType | null = null
let nativePluginLoading: Promise<void> | null = null

const STOP_TIMEOUT_MS = 6000
const POLL_MS = 300
const WEB_SESSION_COOLDOWN_MS = 500
const NATIVE_SESSION_COOLDOWN_MS = 450

let lastWebSpeechEndAt = 0
let lastNativeSpeechEndAt = 0
let speechDrain: Promise<void> = Promise.resolve()

async function waitSpeechCooldown(lastEndAt: number, ms: number): Promise<void> {
  const wait = lastEndAt + ms - Date.now()
  if (wait > 0) await sleep(wait)
}

function markWebSpeechEnded(): void {
  lastWebSpeechEndAt = Date.now()
}

function markNativeSpeechEnded(): void {
  lastNativeSpeechEndAt = Date.now()
}

/** Очередь остановки — следующая карточка ждёт закрытия предыдущей сессии. */
export function releaseSpeechSession(
  stopFn?: (opts?: { cancel: boolean }) => unknown
): Promise<void> {
  if (!stopFn) return speechDrain
  speechDrain = speechDrain
    .then(() => {
      stopFn({ cancel: true })
    })
    .catch(() => {})
  return speechDrain
}

/** Дождаться освобождения микрофона перед новой сессией. */
export async function prepareSpeechSession(): Promise<void> {
  await speechDrain
  await waitSpeechCooldown(lastWebSpeechEndAt, WEB_SESSION_COOLDOWN_MS)
  await waitSpeechCooldown(lastNativeSpeechEndAt, NATIVE_SESSION_COOLDOWN_MS)
}

export function pickSpeechBackend(): "native" | "web" | "none" {
  if (isNativeSpeechPlatform()) return "native"
  if (webSpeechRecognitionSupported()) return "web"
  return "none"
}

export function isNativeSpeechPlatform(): boolean {
  return typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.()
}

export function webSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false
  return webSpeechRecognitionSupported() || isNativeSpeechPlatform()
}

/** Язык и подсказка для режима «Голос». */
export function resolveVoiceSpeechLang(expected?: string): { lang: string; hint: string } {
  const lang = detectSpeechLang(expected ?? "")
  const hint = lang.startsWith("en") ? "Скажите ответ по-английски" : "Скажите перевод по-русски"
  return { lang, hint }
}

/** Дождаться загрузки нативного плагина. Возвращает boolean — не сам плагин (Capacitor-прокси ломает Promise через .then). */
async function loadNativePlugin(): Promise<boolean> {
  if (!isNativeSpeechPlatform()) return false
  if (nativePlugin) return true
  if (!nativePluginLoading) {
    nativePluginLoading = import("../vendor/capacitor-speech-recognition.mjs")
      .then((mod) => {
        nativePlugin = mod.SpeechRecognition
      })
      .catch(() => {
        nativePlugin = null
      })
  }
  await nativePluginLoading
  return !!nativePlugin
}

function withTimeout(promise: Promise<unknown>, ms: number, label: string): Promise<unknown> {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(label || "timeout")), ms)
    })
  ])
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function pickNativeTranscript(event: NativeSpeechEvent | undefined): string {
  const raw: NativeSpeechEvent = event ?? {}
  const matches: unknown[] = Array.isArray(raw.matches) ? raw.matches : []
  const parts = [
    raw.accumulatedText,
    raw.accumulated,
    ...matches,
    raw.text
  ]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
  return parts[0] || ""
}

function mapNativeError(event: NativeSpeechEvent | undefined): string {
  const code = String(event?.code ?? "")
  if (code === "not-allowed" || code === "permission") return "Нет доступа к микрофону"
  if (code === "no-speech") return "Речь не распознана"
  return String((event?.message ?? code) || "Ошибка распознавания")
}

function pickBestAlternative(result: SpeechRecognitionResult): string {
  let best = ""
  let bestConf = -1
  for (let i = 0; i < result.length; i++) {
    const alt = result[i]?.transcript?.trim()
    if (!alt) continue
    const conf = result[i]?.confidence ?? (i === 0 ? 1 : 0)
    if (conf >= bestConf) {
      bestConf = conf
      best = alt
    }
  }
  return best
}

async function ensureNativePermissions(SR: NativeSpeechRecognitionType): Promise<boolean> {
  const current = await SR.checkPermissions()
  if (current.speechRecognition === "granted") return true
  const requested = await SR.requestPermissions()
  return requested.speechRecognition === "granted"
}

async function isLangAvailable(SR: NativeSpeechRecognitionType, lang: string): Promise<boolean> {
  try {
    const res = await SR.available({ language: lang })
    return !!res.available
  } catch (e) {
    return false
  }
}

interface ListenOptions {
  lang?: string
  onResult?: (text: string) => void
  onInterim?: (text: string) => void
  onError?: (err: Error) => void
  onEnd?: () => void
  manualStop?: boolean
  contextualStrings?: string[]
}

function listenOnceNative(options: ListenOptions = {}): () => Promise<void> {
  const {
    lang,
    onResult,
    onInterim,
    onError,
    onEnd,
    contextualStrings = []
  } = options
  let stopped = false
  let cancelled = false
  let delivered = false
  let sessionActive = false
  let transcript = ""
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const handles: NativeSpeechHandle[] = []
  let SR: NativeSpeechRecognitionType | null = null

  function stopPolling(): void {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  function pushTranscript(text: string): void {
    const t = String(text || "").trim()
    if (!t) return
    transcript = t
    onInterim?.(t)
  }

  async function teardown(): Promise<void> {
    stopPolling()
    await Promise.all(handles.splice(0).map((h) => h.remove().catch(() => {})))
  }

  function finish(onResultArg?: string): void {
    if (delivered) return
    delivered = true
    if (!cancelled) onResult?.(onResultArg ?? transcript)
    onEnd?.()
  }

  async function refreshTranscript(): Promise<void> {
    if (!SR?.getLastPartialResult) return
    try {
      const last = await withTimeout(SR.getLastPartialResult(), 1500, "partial timeout")
      const text = pickNativeTranscript(last as NativeSpeechEvent)
      if (text) transcript = text
    } catch (e) {}
  }

  function startPolling(): void {
    stopPolling()
    pollTimer = setInterval(() => {
      if (stopped || !sessionActive) return
      refreshTranscript()
        .then(() => {
          if (transcript) onInterim?.(transcript)
        })
        .catch(() => {})
    }, POLL_MS)
  }

  async function haltRecognition(): Promise<void> {
    stopPolling()
    if (!SR) {
      markNativeSpeechEnded()
      finish("")
      return
    }
    sessionActive = false
    try {
      await withTimeout(
        (async () => {
          try {
            await SR.stop()
          } catch (e) {
            await SR.forceStop().catch(() => {})
          }
        })(),
        STOP_TIMEOUT_MS,
        "stop timeout"
      )
    } catch (e) {
      try {
        const sr = SR;
        if (sr) await sr.forceStop().catch(() => sr.stop())
      } catch (e2) {}
    }
    await sleep(250)
    await refreshTranscript()
    await teardown()
    markNativeSpeechEnded()
    finish(transcript)
  }

  async function begin(): Promise<void> {
    try {
      await prepareSpeechSession()
      if (!(await loadNativePlugin())) throw new Error("Нативное распознавание недоступно")
      SR = nativePlugin
      if (!SR) throw new Error("Нативное распознавание недоступно")
      if (stopped) return

      try {
        const sr = SR;
        if (sr) await sr.forceStop().catch(() => sr.stop())
      } catch (e) {}

      if (!(await ensureNativePermissions(SR))) {
        if (!stopped) onError?.(new Error("Нет доступа к микрофону"))
        return
      }
      if (stopped) return

      let speechLang = lang || "ru-RU"
      if (!(await isLangAvailable(SR, speechLang))) {
        const fallback = speechLang.startsWith("en") ? "ru-RU" : "en-US"
        if (await isLangAvailable(SR, fallback)) speechLang = fallback
        else if (!(await isLangAvailable(SR, speechLang))) {
          if (!stopped) onError?.(new Error("Распознавание речи недоступно на этом устройстве"))
          return
        }
      }
      if (stopped) return

      handles.push(
        await SR.addListener("partialResults", (event) => {
          pushTranscript(pickNativeTranscript(event))
        })
      )

      handles.push(
        await SR.addListener("error", (event) => {
          if (stopped || delivered) return
          onError?.(new Error(mapNativeError(event)))
        })
      )

      const hints = contextualStrings
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .slice(0, 12)

      await withTimeout(
        SR.start({
          language: speechLang,
          partialResults: true,
          maxResults: 5,
          contextualStrings: hints.length ? hints : undefined
        }),
        STOP_TIMEOUT_MS,
        "start timeout"
      )
      sessionActive = true
      startPolling()

      if (stopped) await haltRecognition()
    } catch (e) {
      sessionActive = false
      markNativeSpeechEnded()
      await teardown()
      if (!stopped) onError?.(e instanceof Error ? e : new Error(String(e)))
    }
  }

  begin()

  return async ({ cancel = false }: { cancel?: boolean } = {}): Promise<void> => {
    if (stopped) return
    stopped = true
    cancelled = !!cancel
    await haltRecognition()
  }
}

function listenOnceWeb(options: ListenOptions = {}): () => Promise<void> {
  const { lang, onResult, onInterim, onError, onEnd, manualStop = false } = options
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    onError?.(new Error("Распознавание речи недоступно в этом браузере"))
    return async () => {}
  }
  const rec = new SR()
  rec.lang = lang || "ru-RU"
  rec.interimResults = manualStop
  rec.maxAlternatives = manualStop ? 5 : 1
  rec.continuous = manualStop

  let stopped = false
  let cancelled = false
  let delivered = false
  let started = false
  let endResolve: (() => void) | null = null
  const endPromise = new Promise<void>((resolve) => {
    endResolve = resolve
  })
  const finals: string[] = []
  let interim = ""

  function transcriptText(): string {
    return [...finals, interim].filter(Boolean).join(" ").trim()
  }

  function signalEnded(): void {
    markWebSpeechEnded()
    endResolve?.()
    endResolve = null
  }

  function finish(text: string): void {
    if (delivered) return
    delivered = true
    if (!cancelled) onResult?.(text ?? transcriptText())
    onEnd?.()
    signalEnded()
  }

  rec.onresult = (e: SpeechRecognitionEventLike) => {
    interim = ""
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i]
      if (!r) continue
      const t = pickBestAlternative(r)
      if (!t) continue
      if (r.isFinal) finals.push(t)
      else interim = interim ? `${interim} ${t}` : t
    }
    const current = transcriptText()
    if (current) onInterim?.(current)
    if (!manualStop && finals.length) {
      stopped = true
      finish(current)
    }
  }

  rec.onerror = (e: SpeechRecognitionErrorLike) => {
    if (stopped || delivered || cancelled) return
    if (e.error === "aborted") return
    const msg =
      e.error === "not-allowed"
        ? "Нет доступа к микрофону"
        : e.error === "no-speech"
          ? "Речь не распознана"
          : e.error || "Ошибка распознавания"
    signalEnded()
    onError?.(new Error(msg))
  }

  rec.onend = () => {
    started = false
    if (manualStop) {
      if (!stopped) {
        onEnd?.()
        signalEnded()
        return
      }
      finish(transcriptText())
      return
    }
    if (!stopped) onEnd?.()
    signalEnded()
  }

  const cooldownLeft = lastWebSpeechEndAt + WEB_SESSION_COOLDOWN_MS - Date.now()
  if (cooldownLeft > 0) {
    signalEnded()
    onError?.(new Error("Подождите секунду и нажмите снова"))
    return async () => {}
  }

  try {
    rec.start()
    started = true
  } catch (e) {
    signalEnded()
    onError?.(e instanceof Error ? e : new Error(String(e)))
    return async () => {}
  }

  return async ({ cancel = false }: { cancel?: boolean } = {}): Promise<void> => {
    if (stopped && delivered) return
    stopped = true
    cancelled = !!cancel
    if (!started) {
      finish("")
      await endPromise
      return
    }
    try {
      rec.stop()
    } catch (e) {}
    await Promise.race([endPromise, sleep(4000)])
    if (!delivered) finish("")
  }
}

/**
 * Распознавание речи. Возвращает async stop({ cancel }).
 * На Capacitor iOS — нативный плагин (много карточек); в браузере — Web Speech API.
 */
export function listenOnce(options: ListenOptions = {}): () => Promise<void> {
  if (isNativeSpeechPlatform()) return listenOnceNative(options)
  if (webSpeechRecognitionSupported()) return listenOnceWeb(options)
  return listenOnceWeb(options)
}
