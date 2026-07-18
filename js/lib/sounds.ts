export interface SoundMeta {
  id: string
  label: string
  file?: string
}

export const SUCCESS_MELODIES: SoundMeta[] = [
  { id: "clear-combo", label: "Clear combo", file: "audio/success/clear-combo.mp3" },
  { id: "ui-pop", label: "UI pop", file: "audio/success/ui-pop.mp3" },
  { id: "soft-plopp", label: "Soft plopp", file: "audio/success/soft-plopp.mp3" },
  { id: "ui-notification", label: "UI notify", file: "audio/success/ui-notification.mp3" },
  { id: "confirm-tap", label: "Confirm tap", file: "audio/success/confirm-tap.mp3" }
]

/** Старые id синтезированных мелодий → новые MP3 (миграция настроек). */
const LEGACY_SUCCESS: Record<string, string> = {
  chime: "confirm-tap",
  rise: "clear-combo",
  bell: "ui-notification",
  pop: "ui-pop",
  fanfare: "soft-plopp"
}

export const FAIL_MELODIES: SoundMeta[] = [
  { id: "game-button", label: "Игровая кнопка", file: "audio/fail/game-button.mp3" },
  { id: "sword-cut", label: "Резкий удар", file: "audio/fail/sword-cut.mp3" },
  { id: "short-fail", label: "Короткий сбой", file: "audio/fail/short-fail.mp3" },
  { id: "glitch-error", label: "Глитч ошибки", file: "audio/fail/glitch-error.mp3" },
  { id: "load-fail", label: "Сбой загрузки", file: "audio/fail/load-fail.mp3" }
]

/** Старые id синтезированных мелодий → новые MP3 (миграция настроек). */
const LEGACY_FAIL: Record<string, string> = {
  drop: "load-fail",
  buzz: "short-fail",
  wobble: "glitch-error",
  nuh: "game-button",
  thud: "sword-cut"
}

/** MP3-мелодии экрана с кубком (файлы в audio/). */
export const CUP_MELODIES: SoundMeta[] = [
  { id: "game-bonus", label: "Игровой бонус", file: "audio/game-bonus.mp3" },
  { id: "show-alert", label: "Шоу алерт", file: "audio/show-alert.mp3" },
  { id: "level-up", label: "Level up", file: "audio/level-up.mp3" },
  { id: "victory-chime", label: "Победный звон", file: "audio/victory-chime.mp3" },
  { id: "correct-answer", label: "Верный ответ", file: "audio/correct-answer.mp3" }
]

export const UI_CLICK_MELODIES: SoundMeta[] = [
  { id: "none", label: "Без звука" },
  { id: "system-click", label: "Системный клик", file: "audio/ui/system-click.mp3" },
  { id: "click-soft", label: "Мягкий клик", file: "audio/ui/click-soft.mp3" },
  { id: "click-crisp", label: "Чёткий клик", file: "audio/ui/click-crisp.mp3" }
]

const SUCCESS_IDS = new Set(SUCCESS_MELODIES.map((m) => m.id))
const FAIL_IDS = new Set(FAIL_MELODIES.map((m) => m.id))
const CUP_IDS = new Set(CUP_MELODIES.map((m) => m.id))
const UI_CLICK_IDS = new Set(UI_CLICK_MELODIES.map((m) => m.id))
const SOUND_MODES = new Set(["both", "correct", "wrong", "none"])

export function normalizeSuccessSoundId(id: string): string {
  if (SUCCESS_IDS.has(id)) return id
  if (LEGACY_SUCCESS[id]) return LEGACY_SUCCESS[id]
  return "confirm-tap"
}

export function normalizeFailSoundId(id: string): string {
  if (FAIL_IDS.has(id)) return id
  if (LEGACY_FAIL[id]) return LEGACY_FAIL[id]
  return "load-fail"
}

export function normalizeAnswerSoundMode(mode: string): "both" | "correct" | "wrong" | "none" {
  return SOUND_MODES.has(mode) ? (mode as "both" | "correct" | "wrong" | "none") : "both"
}

export function successSoundLabel(id: string): string {
  return SUCCESS_MELODIES.find((m) => m.id === id)?.label || "Confirm tap"
}

interface SoundAudio extends HTMLAudioElement {
  __soundFile?: string
}

let mp3Audio: Record<string, SoundAudio | null> = {
  success: null,
  fail: null,
  cup: null,
  uiClick: null
}

interface PlayOpts {
  preview?: boolean
  gameplay?: boolean
}

function playMp3(file: string, slot: string, opts?: PlayOpts, volume = 0.85): void {
  if (typeof Audio === "undefined") return
  const reduced =
    !opts?.preview &&
    !opts?.gameplay &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  if (reduced) return
  try {
    let audio = mp3Audio[slot]
    if (!audio || audio.__soundFile !== file) {
      audio = new Audio(file)
      audio.__soundFile = file
      mp3Audio[slot] = audio
    }
    audio.pause()
    audio.currentTime = 0
    audio.volume = volume
    audio.play().catch(() => {})
  } catch (e) {}
}

function primeMp3(file: string, slot: string): void {
  if (typeof Audio === "undefined") return
  try {
    let audio = mp3Audio[slot]
    if (!audio || audio.__soundFile !== file) {
      audio = new Audio(file)
      audio.__soundFile = file
      mp3Audio[slot] = audio
    }
    audio.pause()
    audio.currentTime = 0
    audio.muted = true
    audio.volume = 0
    audio
      .play()
      .then(() => {
        audio!.pause()
        audio!.currentTime = 0
        audio!.muted = false
      })
      .catch(() => {
        if (audio) audio.muted = false
      })
  } catch (e) {}
}

export function failSoundLabel(id: string): string {
  return FAIL_MELODIES.find((m) => m.id === id)?.label || "Сбой загрузки"
}

export function normalizeCupMelodyId(id: string): string {
  return CUP_IDS.has(id) ? id : "show-alert"
}

export function cupMelodyLabel(id: string): string {
  return CUP_MELODIES.find((m) => m.id === id)?.label || "Шоу алерт"
}

export function normalizeUiClickSoundId(id: string): string {
  return UI_CLICK_IDS.has(id) ? id : "none"
}

export function uiClickSoundLabel(id: string): string {
  return UI_CLICK_MELODIES.find((m) => m.id === id)?.label || "Без звука"
}

export function playUiClickSound(melodyId: string = "none", opts?: PlayOpts): void {
  const id = normalizeUiClickSoundId(melodyId)
  if (id === "none") return
  const meta = UI_CLICK_MELODIES.find((m) => m.id === id)
  if (!meta?.file) return
  playMp3(meta.file, "uiClick", opts, 0.65)
}

/** Проиграть MP3 при появлении кубка. */
export function playCupMelody(melodyId: string = "show-alert", opts?: PlayOpts): void {
  const meta = CUP_MELODIES.find((m) => m.id === normalizeCupMelodyId(melodyId))
  if (!meta) return
  playMp3(meta.file ?? "", "cup", opts, 0.9)
}

function shouldPlaySound(isCorrect: boolean, mode: string): boolean {
  const m = normalizeAnswerSoundMode(mode)
  if (m === "none") return false
  if (isCorrect) return m === "both" || m === "correct"
  return m === "both" || m === "wrong"
}

export interface Settings {
  answerSoundMode: "both" | "correct" | "wrong" | "none"
  successSound: string
  failSound: string
  cupMelody: string
}

export function playLessonCompleteFromStore(_stars: number): void {
  if (typeof document === "undefined") return
  import("../core/state.js")
    .then((m) => {
      const mode = normalizeAnswerSoundMode(m.store?.settings?.answerSoundMode ?? "both")
      if (mode === "none") return
      playCupMelody(normalizeCupMelodyId(m.store?.settings?.cupMelody ?? "show-alert"))
    })
    .catch(() => {})
}

export function playSuccessSound(melodyId: string = "confirm-tap", opts?: PlayOpts): void {
  const meta = SUCCESS_MELODIES.find((m) => m.id === normalizeSuccessSoundId(melodyId))
  if (!meta?.file) return
  playMp3(meta.file, "success", { gameplay: true, ...opts }, 0.85)
}

export function playFailSound(melodyId: string = "load-fail", opts?: PlayOpts): void {
  const meta = FAIL_MELODIES.find((m) => m.id === normalizeFailSoundId(melodyId))
  if (!meta?.file) return
  playMp3(meta.file, "fail", { gameplay: true, ...opts }, 0.85)
}

/** Остановить MP3-звуки ответов (освободить аудио-сессию перед микрофоном). */
export function stopAnswerAudio(): void {
  Object.values(mp3Audio).forEach((audio) => {
    if (!audio) return
    try {
      audio.pause()
      audio.currentTime = 0
    } catch (e) {}
  })
}

/** Разблокировать аудио ответов на жесте пользователя. */
export function unlockAnswerAudio(settings: Settings | null): void {
  if (typeof document === "undefined" || !settings) return
  const mode = normalizeAnswerSoundMode(settings.answerSoundMode)
  if (shouldPlaySound(true, mode)) {
    const meta = SUCCESS_MELODIES.find(
      (m) => m.id === normalizeSuccessSoundId(settings.successSound)
    )
    if (meta?.file) primeMp3(meta.file, "success")
  }
  if (shouldPlaySound(false, mode)) {
    const meta = FAIL_MELODIES.find((m) => m.id === normalizeFailSoundId(settings.failSound))
    if (meta?.file) primeMp3(meta.file, "fail")
  }
}

export function unlockAnswerAudioFromStore(): void {
  if (typeof document === "undefined") return
  import("../core/state.js")
    .then((m) => {
      unlockAnswerAudio(m.store?.settings ?? null)
    })
    .catch(() => {})
}

export function playAnswerFeedback(isCorrect: boolean, settings: Settings | null): void {
  if (!settings) return
  const mode = normalizeAnswerSoundMode(settings.answerSoundMode)
  if (!shouldPlaySound(isCorrect, mode)) return
  if (isCorrect) playSuccessSound(settings.successSound)
  else playFailSound(settings.failSound)
}

export function playAnswerFeedbackFromStore(isCorrect: boolean): void {
  if (typeof document === "undefined") return
  import("../core/state.js")
    .then((m) => {
      playAnswerFeedback(isCorrect, m.store?.settings ?? null)
    })
    .catch(() => {})
}

export interface SoundsAPI {
  SUCCESS_MELODIES: typeof SUCCESS_MELODIES
  FAIL_MELODIES: typeof FAIL_MELODIES
  CUP_MELODIES: typeof CUP_MELODIES
  UI_CLICK_MELODIES: typeof UI_CLICK_MELODIES
  normalizeSuccessSoundId: typeof normalizeSuccessSoundId
  normalizeFailSoundId: typeof normalizeFailSoundId
  normalizeAnswerSoundMode: typeof normalizeAnswerSoundMode
  successSoundLabel: typeof successSoundLabel
  failSoundLabel: typeof failSoundLabel
  normalizeCupMelodyId: typeof normalizeCupMelodyId
  cupMelodyLabel: typeof cupMelodyLabel
  normalizeUiClickSoundId: typeof normalizeUiClickSoundId
  uiClickSoundLabel: typeof uiClickSoundLabel
  playUiClickSound: typeof playUiClickSound
  playCupMelody: typeof playCupMelody
  playSuccessSound: typeof playSuccessSound
  playFailSound: typeof playFailSound
  stopAnswerAudio: typeof stopAnswerAudio
  unlockAnswerAudio: typeof unlockAnswerAudio
  unlockAnswerAudioFromStore: typeof unlockAnswerAudioFromStore
  playAnswerFeedback: typeof playAnswerFeedback
  playAnswerFeedbackFromStore: typeof playAnswerFeedbackFromStore
  playLessonCompleteFromStore: typeof playLessonCompleteFromStore
}
