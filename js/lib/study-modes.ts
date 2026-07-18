type Mode = "flip" | "type" | "voice" | "match" | "combo" | "cloze";

const MODES = new Set<Mode>(["flip", "type", "voice", "match", "combo", "cloze"]);
const STORAGE_KEY = "kar_last_study_mode";
const SESSION_KEY = "kar_session_study_mode";
const PROMPT_SIDE_KEY = "kar_last_prompt_side";
const SESSION_PROMPT_SIDE_KEY = "kar_session_prompt_side";
const SESSION_CRAM_LIMIT_KEY = "kar_session_cram_limit";
const CRAM_LIMIT_KEY = "kar_last_cram_limit";

export interface PromptSideMeta {
  id: "front" | "back";
  label: string;
  desc: string;
}

export interface StudyModeMeta {
  id: Mode;
  title: string;
  desc: string;
}

export const PROMPT_SIDE_META: PromptSideMeta[] = [
  { id: "front", label: "Лицо", desc: "Видите термин — вводите или говорите перевод" },
  { id: "back", label: "Оборот", desc: "Видите перевод — вводите или говорите термин" }
];

export const STUDY_MODE_META: StudyModeMeta[] = [
  { id: "flip", title: "Классический", desc: "Переворот карточки и свайп «Знаю / Не знаю»" },
  { id: "type", title: "Ввод", desc: "Напечатать перевод или ответ" },
  { id: "cloze", title: "Пропуски", desc: "Слово — дописать буквы; фраза — дописать слова" },
  { id: "voice", title: "Голос", desc: "Сказать перевод в микрофон" },
  { id: "combo", title: "Микс", desc: "Случайно: ввод, голос или 5 пар слов" },
  { id: "match", title: "Пары", desc: "Собрать термины и переводы в пары" }
];

export function isStudyMode(v: unknown): v is Mode {
  return MODES.has(v as Mode);
}

export interface ReviewRoute {
  folderId: string | null;
  cram: boolean;
  mode: Mode;
  cramLimit: number | null;
}

export function parseReviewRoute(parts: string[]): ReviewRoute {
  let folderId: string | null = null;
  let cram = false;
  let mode: Mode = "flip";
  let cramLimit: number | null = null;
  const rest = parts.slice(1);
  if (!rest.length) return { folderId, cram, mode, cramLimit };

  let i = 0;
  const first = rest[0];
  if (MODES.has(first as Mode)) {
    return { folderId: null, cram: false, mode: first as Mode, cramLimit: null };
  }

  folderId = first ?? null;
  i = 1;

  if (rest[i] === "cram") {
    cram = true;
    i += 1;
    const limitRaw = rest[i];
    if (limitRaw && /^\d+$/.test(limitRaw)) {
      cramLimit = parseInt(limitRaw, 10);
      i += 1;
    }
    const modeRaw = rest[i];
    if (modeRaw && MODES.has(modeRaw as Mode)) mode = modeRaw as Mode;
  } else {
    const modeRaw = rest[i];
    if (modeRaw && MODES.has(modeRaw as Mode)) mode = modeRaw as Mode;
  }

  return { folderId, cram, mode, cramLimit };
}

export function buildReviewHash(
  folderId: string | null,
  { cram = false, mode = "flip", cramLimit = null }: { cram?: boolean; mode?: Mode; cramLimit?: number | null } = {}
): string {
  const segs: string[] = ["review"];
  if (folderId) segs.push(folderId);
  if (cram) segs.push("cram");
  if (cram && cramLimit != null && cramLimit > 0) segs.push(String(cramLimit));
  if (mode && mode !== "flip") segs.push(mode);
  return "#" + segs.join("/");
}

export function getLastStudyMode(): Mode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.has(v as Mode) ? (v as Mode) : "flip";
  } catch (e) {
    return "flip";
  }
}

export function setLastStudyMode(mode: Mode): void {
  if (!MODES.has(mode)) return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {}
}

/** Режим текущей сессии — надёжнее hash при переходе из picker. */
export function setSessionStudyMode(mode: Mode): void {
  if (!MODES.has(mode)) return;
  try {
    sessionStorage.setItem(SESSION_KEY, mode);
  } catch (e) {}
}

export function resolveStudyMode(urlMode: string): Mode {
  const fromUrl = MODES.has(urlMode as Mode) ? (urlMode as Mode) : "flip";
  try {
    const pending = sessionStorage.getItem(SESSION_KEY);
    if (pending && MODES.has(pending as Mode)) {
      sessionStorage.removeItem(SESSION_KEY);
      return pending as Mode;
    }
  } catch (e) {}
  if (fromUrl !== "flip") return fromUrl;
  const last = getLastStudyMode();
  if (last && last !== "flip") return last;
  return "flip";
}

export function studyModeLabel(mode: Mode): string {
  return STUDY_MODE_META.find((m) => m.id === mode)?.title || "Классический";
}

export function promptSideLabel(side: "front" | "back"): string {
  return PROMPT_SIDE_META.find((s) => s.id === side)?.label || "Лицо";
}

export function normalizePromptSide(side: string): "front" | "back" {
  return side === "back" ? "back" : "front";
}

export function getLastPromptSide(): "front" | "back" {
  try {
    const v = localStorage.getItem(PROMPT_SIDE_KEY);
    return v === "back" ? "back" : "front";
  } catch (e) {
    return "front";
  }
}

export function setLastPromptSide(side: "front" | "back"): void {
  const s = normalizePromptSide(side);
  try {
    localStorage.setItem(PROMPT_SIDE_KEY, s);
  } catch (e) {}
}

export function setSessionPromptSide(side: "front" | "back"): void {
  const s = normalizePromptSide(side);
  try {
    sessionStorage.setItem(SESSION_PROMPT_SIDE_KEY, s);
  } catch (e) {}
  setLastPromptSide(s);
}

/** Считывает сторону сессии закрепления (один раз при старте). */
export function consumeSessionPromptSide(): "front" | "back" | null {
  try {
    const v = sessionStorage.getItem(SESSION_PROMPT_SIDE_KEY);
    sessionStorage.removeItem(SESSION_PROMPT_SIDE_KEY);
    return v === "back" ? "back" : v === "front" ? "front" : null;
  } catch (e) {
    return null;
  }
}

export function getLastCramLimit(): number | null {
  try {
    const v = localStorage.getItem(CRAM_LIMIT_KEY);
    if (v === "" || v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

export function setLastCramLimit(limit: number | null): void {
  try {
    if (limit == null || limit <= 0) localStorage.removeItem(CRAM_LIMIT_KEY);
    else localStorage.setItem(CRAM_LIMIT_KEY, String(limit));
  } catch (e) {}
}

/** Лимит карточек для закрепления (null = все). Считывается один раз при старте. */
export function setSessionCramLimit(limit: number | null): void {
  try {
    if (limit == null || limit <= 0) sessionStorage.removeItem(SESSION_CRAM_LIMIT_KEY);
    else sessionStorage.setItem(SESSION_CRAM_LIMIT_KEY, String(limit));
    setLastCramLimit(limit);
  } catch (e) {}
}

export function consumeSessionCramLimit(): number | null {
  try {
    const v = sessionStorage.getItem(SESSION_CRAM_LIMIT_KEY);
    sessionStorage.removeItem(SESSION_CRAM_LIMIT_KEY);
    if (v === "" || v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch (e) {
    return null;
  }
}

export interface StudyModesAPI {
  isStudyMode: typeof isStudyMode;
  parseReviewRoute: typeof parseReviewRoute;
  buildReviewHash: typeof buildReviewHash;
  getLastStudyMode: typeof getLastStudyMode;
  setLastStudyMode: typeof setLastStudyMode;
  setSessionStudyMode: typeof setSessionStudyMode;
  resolveStudyMode: typeof resolveStudyMode;
  studyModeLabel: typeof studyModeLabel;
  promptSideLabel: typeof promptSideLabel;
  normalizePromptSide: typeof normalizePromptSide;
  getLastPromptSide: typeof getLastPromptSide;
  setLastPromptSide: typeof setLastPromptSide;
  setSessionPromptSide: typeof setSessionPromptSide;
  consumeSessionPromptSide: typeof consumeSessionPromptSide;
  getLastCramLimit: typeof getLastCramLimit;
  setLastCramLimit: typeof setLastCramLimit;
  setSessionCramLimit: typeof setSessionCramLimit;
  consumeSessionCramLimit: typeof consumeSessionCramLimit;
  PROMPT_SIDE_META: typeof PROMPT_SIDE_META;
  STUDY_MODE_META: typeof STUDY_MODE_META;
}
