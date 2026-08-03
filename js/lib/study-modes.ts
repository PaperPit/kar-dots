import { t } from "./i18n.js";

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

/** Localized prompt-side options (call at render time). */
export function getPromptSideMeta(): PromptSideMeta[] {
  return [
    { id: "front", label: t("review.side.front"), desc: t("review.side.frontDesc") },
    { id: "back", label: t("review.side.back"), desc: t("review.side.backDesc") }
  ];
}

/** Localized study-mode options (call at render time). */
export function getStudyModeMeta(): StudyModeMeta[] {
  return [
    { id: "flip", title: t("review.mode.flip.title"), desc: t("review.mode.flip.desc") },
    { id: "type", title: t("review.mode.type.title"), desc: t("review.mode.type.desc") },
    { id: "cloze", title: t("review.mode.cloze.title"), desc: t("review.mode.cloze.desc") },
    { id: "voice", title: t("review.mode.voice.title"), desc: t("review.mode.voice.desc") },
    { id: "combo", title: t("review.mode.combo.title"), desc: t("review.mode.combo.desc") },
    { id: "match", title: t("review.mode.match.title"), desc: t("review.mode.match.desc") }
  ];
}

/** @deprecated Prefer getPromptSideMeta() — snapshot at module load. */
export const PROMPT_SIDE_META: PromptSideMeta[] = getPromptSideMeta();

/** @deprecated Prefer getStudyModeMeta() — snapshot at module load. */
export const STUDY_MODE_META: StudyModeMeta[] = getStudyModeMeta();

export function isStudyMode(v: unknown): v is Mode {
  return MODES.has(v as Mode);
}

export interface ReviewRoute {
  folderId: string | null;
  noteId: string | null;
  cram: boolean;
  mode: Mode;
  cramLimit: number | null;
}

export function parseReviewRoute(parts: string[]): ReviewRoute {
  let folderId: string | null = null;
  let noteId: string | null = null;
  let cram = false;
  let mode: Mode = "flip";
  let cramLimit: number | null = null;
  const rest = parts.slice(1);
  if (!rest.length) return { folderId, noteId, cram, mode, cramLimit };

  let i = 0;
  const first = rest[0];
  if (MODES.has(first as Mode)) {
    return { folderId: null, noteId: null, cram: false, mode: first as Mode, cramLimit: null };
  }
  if (first === "note" && rest[1]) {
    noteId = decodeURIComponent(rest[1] ?? "");
    i = 2;
    const modeRaw = rest[i];
    if (modeRaw && MODES.has(modeRaw as Mode)) mode = modeRaw as Mode;
    return { folderId: null, noteId, cram: false, mode, cramLimit: null };
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

  return { folderId, noteId, cram, mode, cramLimit };
}

export function buildReviewHash(
  folderId: string | null,
  { cram = false, mode = "flip", cramLimit = null, noteId = null }: { cram?: boolean; mode?: Mode; cramLimit?: number | null; noteId?: string | null } = {}
): string {
  const segs: string[] = ["review"];
  if (noteId) {
    segs.push("note", encodeURIComponent(noteId));
    if (mode && mode !== "flip") segs.push(mode);
    return "#" + segs.join("/");
  }
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
  const key = `review.mode.${mode}.title`;
  const label = t(key);
  return label === key ? t("review.mode.flip.title") : label;
}

export function promptSideLabel(side: "front" | "back"): string {
  return side === "back" ? t("review.side.back") : t("review.side.front");
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
  getPromptSideMeta: typeof getPromptSideMeta;
  getStudyModeMeta: typeof getStudyModeMeta;
  PROMPT_SIDE_META: typeof PROMPT_SIDE_META;
  STUDY_MODE_META: typeof STUDY_MODE_META;
}
