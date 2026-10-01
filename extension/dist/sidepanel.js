// src/sidepanel/error-guard.ts
var FALLBACK_ID = "kar-boot-fallback";
function removeFallback() {
  document.getElementById(FALLBACK_ID)?.remove();
}
function paint(msg) {
  const host = document.getElementById("app") || document.body;
  if (!host) return;
  const box = document.createElement("div");
  box.style.cssText = "margin:16px 14px;padding:14px;border:1px solid rgba(196,69,60,.35);border-radius:12px;background:#fff;color:#1c1611;font:14px/1.45 system-ui,sans-serif";
  const h = document.createElement("p");
  h.style.cssText = "margin:0 0 8px;font-weight:600;color:#c4453c";
  h.textContent = "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043D\u0435 \u0441\u043C\u043E\u0433\u043B\u043E \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C\u0441\u044F";
  const p = document.createElement("p");
  p.style.cssText = "margin:0 0 8px;white-space:pre-wrap;word-break:break-word";
  p.textContent = msg;
  const hint = document.createElement("p");
  hint.style.cssText = "margin:0;color:#7a6d5f;font-size:13px";
  hint.textContent = "\u0421\u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u044D\u0442\u043E\u0442 \u0442\u0435\u043A\u0441\u0442 \u2014 \u043F\u043E \u043D\u0435\u043C\u0443 \u0432\u0438\u0434\u043D\u043E, \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u0443\u043F\u0430\u043B\u043E \u043D\u0430 \u0441\u0442\u0430\u0440\u0442\u0435.";
  box.append(h, p, hint);
  host.replaceChildren(box);
}
function describe(e) {
  if (e instanceof Error) return (e.stack || e.name + ": " + e.message).slice(0, 1500);
  return String(e).slice(0, 1500);
}
window.addEventListener("error", (ev) => {
  paint(
    describe(ev.error || ev.message) + (ev.filename ? `

${ev.filename}:${ev.lineno}:${ev.colno}` : "")
  );
});
window.addEventListener("unhandledrejection", (ev) => {
  paint(describe(ev.reason));
});
removeFallback();

// src/lib/constants.ts
var APP_ORIGIN = "https://kar-tochki.pages.dev";
var CONNECT_URL = `${APP_ORIGIN}/#settings`;
var STORAGE_KEYS = {
  prefs: "kar_ext_prefs",
  video: "kar_ext_video"
};
var MODES = [
  { id: "words", label: "\u0421\u043B\u043E\u0432\u0430" },
  { id: "phrases", label: "\u0424\u0440\u0430\u0437\u044B" },
  { id: "both", label: "\u0421\u043B\u043E\u0432\u0430 + \u0444\u0440\u0430\u0437\u044B" },
  { id: "sentences", label: "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F" }
];
var DEFAULT_PREFS = {
  mode: "both",
  mergeCues: true,
  folderName: "YouTube",
  supadataApiKey: "",
  geminiApiKey: "",
  groqApiKey: ""
};

// src/lib/i18n.ts
var ru = {
  "brand.title": "\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438",
  "brand.sub": "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u0437 YouTube",
  "fatal.title": "\u041E\u043A\u043D\u043E \u043D\u0435 \u0441\u043C\u043E\u0433\u043B\u043E \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C\u0441\u044F: {message}",
  "fatal.hint": "\u0415\u0441\u043B\u0438 \u044D\u0442\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F \u2014 \u043F\u0440\u0430\u0432\u044B\u0439 \u043A\u043B\u0438\u043A \u043F\u043E \u043E\u043A\u043D\u0443 \u2192 \xAB\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043A\u043E\u0434\xBB \u0438 \u043F\u0440\u0438\u0448\u043B\u0438 \u0442\u0435\u043A\u0441\u0442 \u0438\u0437 \u0432\u043A\u043B\u0430\u0434\u043A\u0438 Console.",
  "fatal.retry": "\u041F\u043E\u043F\u0440\u043E\u0431\u043E\u0432\u0430\u0442\u044C \u0441\u043D\u043E\u0432\u0430",
  "account.localOnly": "\u0411\u0435\u0437 \u043E\u0431\u043B\u0430\u043A\u0430 \u2014 \u044D\u043A\u0441\u043F\u043E\u0440\u0442 JSON",
  "account.openApp": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438",
  "mode.words": "\u0421\u043B\u043E\u0432\u0430",
  "mode.phrases": "\u0424\u0440\u0430\u0437\u044B",
  "mode.both": "\u0421\u043B\u043E\u0432\u0430 + \u0444\u0440\u0430\u0437\u044B",
  "mode.sentences": "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
  "form.mergeCues": "\u0421\u043A\u043B\u0435\u0438\u0432\u0430\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
  "form.noFolders": "\u041D\u0435\u0442 \u043F\u0430\u043F\u043E\u043A \u2014 \u0441\u043E\u0437\u0434\u0430\u0439 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438",
  "form.generate": "\u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  "form.videoFallback": "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0432\u0438\u0434\u0435\u043E",
  "form.urlFallback": "\u041E\u0442\u043A\u0440\u043E\u0439 \u0440\u043E\u043B\u0438\u043A \u043D\u0430 YouTube",
  "form.whatLabel": "\u0427\u0442\u043E \u0434\u043E\u0441\u0442\u0430\u0442\u044C \u0438\u0437 \u0440\u043E\u043B\u0438\u043A\u0430",
  "form.folderLabel": "\u0418\u043C\u044F \u043F\u0430\u043F\u043A\u0438 \u0432 \u044D\u043A\u0441\u043F\u043E\u0440\u0442\u0435",
  "form.keysLabel": "API-\u043A\u043B\u044E\u0447\u0438 (Supadata / Gemini / Groq)",
  "form.exportHint": "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0441\u043A\u0430\u0447\u0430\u044E\u0442\u0441\u044F JSON-\u0444\u0430\u0439\u043B\u043E\u043C \u2014 \u0438\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439 \u0432 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F.",
  "form.badUrl": "\u041D\u0435 \u043F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430 \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 YouTube-\u0432\u0438\u0434\u0435\u043E \u2014 \u043E\u0442\u043A\u0440\u043E\u0439 \u0440\u043E\u043B\u0438\u043A \u043D\u0430 YouTube",
  "form.needSupadata": "\u0423\u043A\u0430\u0436\u0438 Supadata API \u043A\u043B\u044E\u0447 \u0432 \u043F\u043E\u043B\u044F\u0445 \u0432\u044B\u0448\u0435",
  "form.needLlm": "\u0423\u043A\u0430\u0436\u0438 Gemini \u0438\u043B\u0438 Groq API \u043A\u043B\u044E\u0447 \u0432 \u043F\u043E\u043B\u044F\u0445 \u0432\u044B\u0448\u0435",
  "form.empty": "\u041A\u0430\u0440\u0442\u043E\u0447\u0435\u043A \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C",
  "progress.cancel": "\u041E\u0442\u043C\u0435\u043D\u0430",
  "progress.fetchVideo": "\u041F\u043E\u043B\u0443\u0447\u0430\u044E \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0438\u0434\u0435\u043E\u2026",
  "progress.generate": "\u0421\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438\u2026",
  "progress.checkSentences": "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u043D\u043E\u0432\u044B\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u2026",
  "progress.checkWords": "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u043D\u043E\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430\u2026",
  "preview.selected": "\u0412\u044B\u0431\u0440\u0430\u043D\u043E: {n}",
  "preview.title": "\u041F\u0440\u0435\u0432\u044C\u044E",
  "preview.hint": "\u041E\u0442\u043C\u0435\u0442\u044C, \u0447\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C, \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u043E\u043F\u0440\u0430\u0432\u044C \u043F\u0435\u0440\u0435\u0432\u043E\u0434",
  "preview.create": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C JSON",
  "preview.back": "\u041D\u0430\u0437\u0430\u0434",
  "preview.group.words": "\u0421\u043B\u043E\u0432\u0430",
  "preview.group.phrases": "\u0424\u0440\u0430\u0437\u044B",
  "preview.group.sentences": "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F",
  "save.exported": "\u0421\u043A\u0430\u0447\u0430\u043D\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A: {ok}",
  "save.openImport": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0434\u043B\u044F \u0438\u043C\u043F\u043E\u0440\u0442\u0430",
  "error.generic": "\u043E\u0448\u0438\u0431\u043A\u0430"
};
var en = {
  "brand.title": "KAR-dots",
  "brand.sub": "Cards from YouTube",
  "fatal.title": "The panel failed to start: {message}",
  "fatal.hint": "If this keeps happening \u2014 right-click the panel \u2192 Inspect and send the Console text.",
  "fatal.retry": "Try again",
  "account.localOnly": "No cloud \u2014 JSON export",
  "account.openApp": "Open KAR-dots",
  "mode.words": "Words",
  "mode.phrases": "Phrases",
  "mode.both": "Words + phrases",
  "mode.sentences": "Sentences",
  "form.mergeCues": "Merge short cues into sentences",
  "form.noFolders": "No folders \u2014 create one in the app",
  "form.generate": "Generate",
  "form.videoFallback": "Current video",
  "form.urlFallback": "Open a YouTube video",
  "form.whatLabel": "What to extract",
  "form.folderLabel": "Folder name in export",
  "form.keysLabel": "API keys (Supadata / Gemini / Groq)",
  "form.exportHint": "Cards download as JSON \u2014 import them in the app Settings.",
  "form.badUrl": "That doesn\u2019t look like a YouTube video URL \u2014 open a video on YouTube",
  "form.needSupadata": "Add a Supadata API key in the fields above",
  "form.needLlm": "Add a Gemini or Groq API key in the fields above",
  "form.empty": "No cards found",
  "progress.cancel": "Cancel",
  "progress.fetchVideo": "Fetching video\u2026",
  "progress.generate": "Building cards\u2026",
  "progress.checkSentences": "Checking new sentences\u2026",
  "progress.checkWords": "Checking new words\u2026",
  "preview.selected": "Selected: {n}",
  "preview.title": "Preview",
  "preview.hint": "Tick what to keep; edit the translation if needed",
  "preview.create": "Download JSON",
  "preview.back": "Back",
  "preview.group.words": "Words",
  "preview.group.phrases": "Phrases",
  "preview.group.sentences": "Sentences",
  "save.exported": "Downloaded cards: {ok}",
  "save.openImport": "Open settings to import",
  "error.generic": "error"
};
var catalogs = { ru, en };
var locale = "ru";
function detectExtLocale() {
  try {
    const ui = typeof chrome !== "undefined" && chrome.i18n?.getUILanguage ? chrome.i18n.getUILanguage() : typeof navigator !== "undefined" ? navigator.language : "ru";
    return String(ui || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
  } catch {
    return "ru";
  }
}
function setExtLocale(next) {
  locale = next;
}
function t(key, vars) {
  const catalog = catalogs[locale] || ru;
  let s = catalog[key] ?? ru[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}
function modeLabel(id) {
  const map = {
    words: "mode.words",
    phrases: "mode.phrases",
    both: "mode.both",
    sentences: "mode.sentences"
  };
  return t(map[id] || id);
}
var EXT_I18N_KEYS = Object.keys(ru);

// src/lib/storage.ts
async function getPrefs() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.prefs);
  return { ...DEFAULT_PREFS, ...data[STORAGE_KEYS.prefs] };
}
async function setPrefs(patch) {
  const next = { ...await getPrefs(), ...patch };
  await chrome.storage.local.set({ [STORAGE_KEYS.prefs]: next });
  return next;
}
async function getVideo() {
  const data = await chrome.storage.session.get(STORAGE_KEYS.video);
  return data[STORAGE_KEYS.video] || null;
}

// src/lib/folders.ts
function defaultExportFolder(name = "YouTube") {
  return { id: "export", name: name || "YouTube" };
}
function settingsFromPrefs(prefs) {
  return {
    supadataApiKey: prefs.supadataApiKey || "",
    geminiApiKey: prefs.geminiApiKey || "",
    groqApiKey: prefs.groqApiKey || ""
  };
}

// ../js/lib/llm-api-keys.js
function strip(raw) {
  return String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, "");
}
var GEMINI_KEY_RE = /^(?:AIza[A-Za-z0-9_-]{10,}|AQ\.[A-Za-z0-9._-]{20,})$/;
function cleanGeminiApiKey(raw) {
  const s = strip(raw);
  if (!s)
    return "";
  if (GEMINI_KEY_RE.test(s))
    return s.slice(0, 512);
  if (/^AQ\./.test(s) && s.length >= 24 && s.length <= 512 && /^[A-Za-z0-9._-]+$/.test(s)) {
    return s;
  }
  if (/^AIza/.test(s) && s.length >= 20 && s.length <= 512 && /^[A-Za-z0-9_-]+$/.test(s)) {
    return s;
  }
  return "";
}
function cleanGroqApiKey(raw) {
  const s = strip(raw);
  if (!s)
    return "";
  if (/^gsk_[A-Za-z0-9_-]{10,200}$/.test(s))
    return s;
  if (/^[A-Za-z0-9_-]{20,200}$/.test(s))
    return s;
  return "";
}
function cleanSupadataApiKey(raw) {
  const s = strip(raw);
  if (!s)
    return "";
  if (/^sd_[A-Za-z0-9_-]{10,200}$/.test(s))
    return s;
  if (/^[A-Za-z0-9_-]{16,200}$/.test(s))
    return s;
  return "";
}

// ../js/lib/youtube-import-settings.js
function getSupadataApiKey(settings2) {
  return cleanSupadataApiKey(settings2?.supadataApiKey || "");
}
function hasSupadataApiKey(settings2) {
  return getSupadataApiKey(settings2).length > 0;
}
function getGeminiApiKey(settings2) {
  return cleanGeminiApiKey(settings2?.geminiApiKey || "");
}
function hasGeminiApiKey(settings2) {
  return getGeminiApiKey(settings2).length > 0;
}
function getGroqApiKey(settings2) {
  return cleanGroqApiKey(settings2?.groqApiKey || "");
}
function hasGroqApiKey(settings2) {
  return getGroqApiKey(settings2).length > 0;
}
function hasGenerateApiKey(settings2) {
  return hasGeminiApiKey(settings2) || hasGroqApiKey(settings2);
}
function withApiKeys(settings2, body) {
  const out = { ...body };
  const supadata = getSupadataApiKey(settings2);
  if (supadata)
    out.supadataApiKey = supadata;
  const gemini = getGeminiApiKey(settings2);
  if (gemini)
    out.geminiApiKey = gemini;
  const groq = getGroqApiKey(settings2);
  if (groq)
    out.groqApiKey = groq;
  return out;
}

// src/lib/yt-job-owner.ts
var STORAGE_KEY = "kar_yt_job_user";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(raw) {
  return UUID_RE.test(String(raw || "").trim());
}
async function anonymousOwnerId() {
  const got = await chrome.storage.local.get(STORAGE_KEY);
  let id = got[STORAGE_KEY];
  if (!id || !isUuid(id)) {
    id = crypto.randomUUID();
    await chrome.storage.local.set({ [STORAGE_KEY]: id });
  }
  return id;
}
async function getExtYtJobUserId() {
  return anonymousOwnerId();
}

// ../js/lib/yt-segment-merge.js
var DEFAULT_MAX_CHARS = 120;
function countWords(text) {
  const s = String(text || "").trim();
  if (!s)
    return 0;
  return s.split(/\s+/).filter(Boolean).length;
}
function endsSentence(text) {
  return /[.!?…]["')\]]*$/.test(String(text || "").trim());
}
function mergeCaptionSegments(segments, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  const out = [];
  let buf = null;
  const flush = () => {
    if (buf?.text?.trim())
      out.push(buf);
    buf = null;
  };
  for (const s of segments || []) {
    const text = String(s?.text || "").replace(/\s+/g, " ").trim();
    if (!text)
      continue;
    const t2 = Math.max(0, Math.round(Number(s?.t) || 0));
    const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : null;
    if (!buf) {
      buf = { t: t2, text, end: end ?? t2 };
      if (endsSentence(text) || text.length >= maxChars)
        flush();
      continue;
    }
    const joined = buf.text + " " + text;
    if (joined.length > maxChars && buf.text) {
      flush();
      buf = { t: t2, text, end: end ?? t2 };
      if (endsSentence(text) || text.length >= maxChars)
        flush();
    } else {
      buf.text = joined;
      buf.end = end ?? t2;
      if (endsSentence(joined) || joined.length >= maxChars)
        flush();
    }
  }
  flush();
  return out;
}

// ../js/lib/youtube-import.js
var ID_PATTERNS = [
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/
];
function parseYouTubeId(url) {
  const s = String(url || "").trim();
  if (/^[\w-]{11}$/.test(s))
    return s;
  for (const re of ID_PATTERNS) {
    const m = s.match(re);
    if (m)
      return m[1];
  }
  return null;
}
function normalizeTerm(s) {
  return String(s || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
}
function stemVariants(word) {
  const w = normalizeTerm(word);
  const out = /* @__PURE__ */ new Set([w]);
  if (!w || w.includes(" "))
    return out;
  const add = (v) => {
    if (v && v.length > 1)
      out.add(v);
  };
  if (w.endsWith("ies") && w.length > 4)
    add(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3)
    add(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss"))
    add(w.slice(0, -1));
  if (w.endsWith("ing") && w.length > 5) {
    const base = w.slice(0, -3);
    add(base);
    add(base + "e");
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2])
      add(base.slice(0, -1));
  }
  if (w.endsWith("ied") && w.length > 4)
    add(w.slice(0, -3) + "y");
  if (w.endsWith("ed") && w.length > 4) {
    const base = w.slice(0, -2);
    add(base);
    add(w.slice(0, -1));
    if (base.length > 2 && base[base.length - 1] === base[base.length - 2])
      add(base.slice(0, -1));
  }
  out.delete("");
  return out;
}
function isKnownTerm(term, knownSet) {
  const n = normalizeTerm(term);
  if (!n)
    return true;
  if (knownSet.has(n))
    return true;
  if (!n.includes(" ")) {
    for (const v of stemVariants(n))
      if (knownSet.has(v))
        return true;
  }
  return false;
}
function filterNewCandidates(candidates, knownSet) {
  const seen = /* @__PURE__ */ new Set();
  const phrases = [];
  const words = [];
  for (const c of candidates || []) {
    const n = normalizeTerm(c && c.front);
    if (!n || seen.has(n))
      continue;
    seen.add(n);
    if (c.kind === "phrase") {
      if (!knownSet.has(n))
        phrases.push(c);
    } else {
      words.push(c);
    }
  }
  const coveredByPhrases = /* @__PURE__ */ new Set();
  for (const p of phrases) {
    for (const token of normalizeTerm(p.front).split(" ")) {
      for (const v of stemVariants(token))
        coveredByPhrases.add(v);
      coveredByPhrases.add(token);
    }
  }
  const newWords = words.filter((w) => {
    const n = normalizeTerm(w.front);
    if (isKnownTerm(n, knownSet))
      return false;
    if (coveredByPhrases.has(n))
      return false;
    for (const v of stemVariants(n))
      if (coveredByPhrases.has(v))
        return false;
    return true;
  });
  return { phrases, words: newWords };
}
function filterTranscriptSegments(segments, { minWords = 3, dedupe = true } = {}) {
  const seen = dedupe ? /* @__PURE__ */ new Set() : null;
  const out = [];
  for (const s of segments || []) {
    const text = String(s?.text || "").replace(/\s+/g, " ").trim();
    if (!text)
      continue;
    if (minWords > 0 && countWords(text) < minWords)
      continue;
    if (seen) {
      const n = normalizeTerm(text);
      if (!n || seen.has(n))
        continue;
      seen.add(n);
    }
    const t2 = Math.max(0, Math.round(Number(s?.t) || 0));
    const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : void 0;
    out.push(end != null ? { t: t2, text, end } : { t: t2, text });
  }
  return out;
}
function filterNewSentences(candidates, knownSet) {
  const seen = /* @__PURE__ */ new Set();
  const sentences = [];
  for (const c of candidates || []) {
    const n = normalizeTerm(c && c.front);
    if (!n || seen.has(n))
      continue;
    seen.add(n);
    if (!knownSet.has(n))
      sentences.push(c);
  }
  return sentences;
}
function fmtTimestamp(sec) {
  const s0 = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s0 / 3600);
  const m = Math.floor(s0 % 3600 / 60);
  const s = s0 % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
var LINK_LEAD_SEC = 2;
function buildYtLink(videoId2, t2) {
  const sec = Math.max(0, Math.floor(Number(t2) || 0) - LINK_LEAD_SEC);
  return `https://www.youtube.com/watch?v=${videoId2}&t=${sec}s`;
}
function buildCardDescription(candidate, videoId2) {
  const parts = [];
  if (candidate.level)
    parts.push(candidate.level);
  const kindLabel = candidate.kind === "phrase" ? "phrase" : candidate.kind === "sentence" ? "sentence" : candidate.pos || "\u0441\u043B\u043E\u0432\u043E";
  parts.push(kindLabel);
  let out = parts.join(" \xB7 ");
  if (videoId2 && candidate.t !== null && candidate.t !== void 0) {
    out += ` \xB7 <a href="${buildYtLink(videoId2, candidate.t)}">\u25B6 ${fmtTimestamp(candidate.t)}</a>`;
  }
  return out;
}

// src/lib/yt-api.ts
var POLL_MS = 2500;
var POLL_MAX_MS = 3 * 60 * 1e3;
async function apiHeaders(extra = {}) {
  return { ...extra, "X-Client-Id": await getExtYtJobUserId() };
}
function apiErrorMessage(status, serverMessage) {
  const msg = String(serverMessage || "").trim();
  if (msg) return msg;
  if (status === 401) return "\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430 \u2014 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0437\u0430\u043D\u043E\u0432\u043E";
  if (status === 413) return "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438 \u0440\u043E\u043B\u0438\u043A \u043F\u043E\u043A\u043E\u0440\u043E\u0447\u0435";
  if (status === 429) return "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0447\u0435\u0440\u0435\u0437 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442";
  if (status === 503) return "\u0421\u0435\u0440\u0432\u0435\u0440 \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u0437\u0436\u0435";
  if (status >= 500) return "\u041E\u0448\u0438\u0431\u043A\u0430 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435 \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u0437\u0436\u0435";
  return "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 (" + status + ")";
}
async function apiJson(path, opts = {}) {
  let res;
  try {
    res = await fetch(APP_ORIGIN + path, {
      ...opts,
      headers: await apiHeaders(opts.headers)
    });
  } catch (e) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("\u041D\u0435\u0442 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0430 \u2014 \u043F\u0440\u043E\u0432\u0435\u0440\u044C \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043D\u043E\u0432\u0430", { cause: e });
    }
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0434\u043E\u0441\u0442\u0443\u0447\u0430\u0442\u044C\u0441\u044F \u0434\u043E ${APP_ORIGIN} (${reason}). \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442; \u0435\u0441\u043B\u0438 \u043E\u043D \u0435\u0441\u0442\u044C \u2014 \u0437\u0430\u043F\u0440\u043E\u0441 \u043C\u043E\u0433 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u0442\u044C VPN, \u0430\u043D\u0442\u0438\u0432\u0438\u0440\u0443\u0441 \u0438\u043B\u0438 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0449\u0438\u043A \u0440\u0435\u043A\u043B\u0430\u043C\u044B.`,
      { cause: e }
    );
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
  }
  if (!res.ok || !data || data.error) {
    throw new Error(apiErrorMessage(res.status, data?.message));
  }
  return data;
}
async function fetchTranscriptFromUrl(url, settings2, {
  isClosed = () => false,
  onStatus = () => {
  }
} = {}) {
  const videoId2 = parseYouTubeId(url);
  if (!videoId2) throw new Error("\u041D\u0435 \u043F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430 \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 YouTube-\u0432\u0438\u0434\u0435\u043E");
  onStatus("\u041F\u043E\u043B\u0443\u0447\u0430\u044E \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0438\u0434\u0435\u043E\u2026");
  const userId = await getExtYtJobUserId();
  let data = await apiJson("/api/yt-video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withApiKeys(settings2, { url, userId }))
  });
  if (data.pending) {
    onStatus("\u041F\u043E\u043B\u0443\u0447\u0430\u044E \u0442\u0440\u0430\u043D\u0441\u043A\u0440\u0438\u043F\u0442 \u0447\u0435\u0440\u0435\u0437 Supadata, \u044D\u0442\u043E \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u043C\u0438\u043D\u0443\u0442\u0443\u2026");
    const deadline = Date.now() + POLL_MAX_MS;
    while (data.pending) {
      if (isClosed()) throw new Error("\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
      if (Date.now() > deadline) {
        throw new Error("\u0420\u0430\u0441\u0448\u0438\u0444\u0440\u043E\u0432\u043A\u0430 \u0437\u0430\u043D\u044F\u043B\u0430 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u043F\u043E\u0437\u0436\u0435");
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      const q = "jobId=" + encodeURIComponent(String(data.jobId)) + "&userId=" + encodeURIComponent(userId);
      data = await apiJson("/api/yt-video?" + q);
    }
  }
  const video = data.video || { videoId: videoId2 };
  const transcript = data.transcript;
  if (!transcript?.segments?.length) {
    throw new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u0442\u0435\u043A\u0441\u0442 \u0432\u0438\u0434\u0435\u043E \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u043D\u0435\u0442 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u043E\u0432");
  }
  return { video, transcript, source: "supadata" };
}
function prepareTranscriptForMode(transcript, mode2, { mergeCues: mergeCues2 = true } = {}) {
  if (mode2 !== "sentences") return transcript;
  let segments = transcript?.segments || [];
  if (mergeCues2) {
    const normalized = segments.map((s) => ({
      t: Number(s?.t) || 0,
      text: String(s?.text ?? ""),
      end: typeof s?.end === "number" ? s.end : null
    }));
    segments = mergeCaptionSegments(normalized).map((s) => ({
      t: s.t,
      text: s.text,
      end: s.end ?? void 0
    }));
  }
  segments = filterTranscriptSegments(segments, { minWords: 3, dedupe: true });
  if (!segments.length) {
    throw new Error("\u041F\u043E\u0441\u043B\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u0438 \u043D\u0435 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439 \u2014 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0434\u0440\u0443\u0433\u0438\u0435 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u044B");
  }
  return { ...transcript, segments };
}
async function generateYoutubeCards({
  video,
  transcript,
  mode: mode2,
  settings: settings2
}, { isClosed = () => false } = {}) {
  if (isClosed()) throw new Error("\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E");
  return apiJson("/api/yt-generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      withApiKeys(settings2, {
        title: video?.title || "",
        lang: transcript.lang || "",
        mode: mode2,
        segments: transcript.segments
      })
    )
  });
}

// src/lib/known-terms.ts
async function loadKnownTermsForImport() {
  return /* @__PURE__ */ new Set();
}

// src/lib/create-cards.ts
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
function buildCardRow(data) {
  const t2 = Date.now();
  return {
    id: uuid(),
    created_at: t2,
    updated_at: t2,
    front: data.front,
    back: data.back,
    description: data.description,
    front_img: null,
    back_img: null,
    folder_id: data.folder_id,
    sm2_ef: 2.5,
    sm2_reps: 0,
    sm2_ivl: 0,
    sm2_due: null,
    box: 0,
    box_due: null
  };
}
function buildImportPayload(folderName2, selected, videoId2) {
  const folderId = uuid();
  const now = Date.now();
  const cards = [];
  for (const { cand, back } of selected) {
    const text = String(back || "").trim();
    if (!text) continue;
    cards.push(
      buildCardRow({
        folder_id: folderId,
        front: cand.front || "",
        back: text,
        description: buildCardDescription(cand, videoId2)
      })
    );
  }
  const payload = {
    version: 3,
    exported_at: now,
    folders: [{ id: folderId, name: folderName2 || "YouTube", created_at: now }],
    boxes: [],
    cards,
    notes: [],
    settings: {}
  };
  return { ok: cards.length, json: JSON.stringify(payload, null, 2) };
}
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2e3);
}

// src/sidepanel/sidepanel.ts
var root = document.getElementById("app");
window.addEventListener("unhandledrejection", (ev) => {
  renderFatal(ev.reason);
});
window.addEventListener("error", (ev) => {
  renderFatal(ev.error || ev.message);
});
var cancelled = false;
var mode = "both";
var mergeCues = true;
var folderName = "YouTube";
var settings = null;
var videoUrl = "";
var videoTitle = "";
var previewItems = [];
var videoId = null;
function el(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (k === "class") node.className = String(v);
    else if (k === "onclick" && typeof v === "function") node.addEventListener("click", v);
    else if (k === "onchange" && typeof v === "function") node.addEventListener("change", v);
    else if (k === "checked") node.checked = !!v;
    else if (k === "disabled") node.disabled = !!v;
    else if (k === "value") node.value = String(v ?? "");
    else if (k === "selected") {
      if (v) node.selected = true;
    } else if (v != null && v !== false) node.setAttribute(k, String(v));
  }
  const kids = Array.isArray(children) ? children : children == null ? [] : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
function brand() {
  return el("div", { class: "brand" }, [
    el("div", { class: "brand-mark" }, "\u041A"),
    el("div", null, [el("h1", null, t("brand.title")), el("p", null, t("brand.sub"))])
  ]);
}
async function refreshVideoFromStorage() {
  try {
    const v = await getVideo();
    if (v?.url) {
      videoUrl = v.url;
      videoTitle = v.title || videoTitle;
    }
  } catch {
  }
  if (videoUrl) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url && /youtube\.com\/(watch|shorts)/.test(tab.url)) {
      videoUrl = tab.url;
      videoTitle = (tab.title || "").replace(/ - YouTube$/, "");
    }
  } catch {
  }
}
function renderFatal(e) {
  const msg = e instanceof Error ? e.message : String(e);
  root.replaceChildren(
    brand(),
    el("div", { class: "card" }, [
      el("p", { class: "error" }, t("fatal.title", { message: msg })),
      el("p", { class: "muted" }, t("fatal.hint")),
      el("div", { class: "actions" }, [
        el("button", { class: "btn primary", onclick: () => void boot() }, t("fatal.retry"))
      ])
    ])
  );
}
async function boot() {
  try {
    setExtLocale(detectExtLocale());
    await bootInner();
  } catch (e) {
    renderFatal(e);
  }
}
async function bootInner() {
  const prefs = await getPrefs();
  mode = prefs.mode;
  mergeCues = prefs.mergeCues;
  folderName = prefs.folderName || "YouTube";
  settings = settingsFromPrefs(prefs);
  await refreshVideoFromStorage();
  renderForm();
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
  ]);
}
function renderForm(error = "") {
  const modeSeg = el("div", { class: "seg" }, []);
  for (const mo of MODES) {
    modeSeg.append(
      el(
        "button",
        {
          type: "button",
          class: mo.id === mode ? "active" : "",
          onclick: () => {
            if (mode === mo.id) return;
            mode = mo.id;
            void setPrefs({ mode }).then(() => renderForm(error));
          }
        },
        modeLabel(mo.id)
      )
    );
  }
  const mergeChk = el("input", {
    type: "checkbox",
    checked: mergeCues,
    onchange: () => {
      mergeCues = mergeChk.checked;
      void setPrefs({ mergeCues });
    }
  });
  const sentencesOpts = el("div", { class: "field" }, [
    el("label", { class: "check-label" }, [mergeChk, el("span", null, t("form.mergeCues"))])
  ]);
  sentencesOpts.style.display = mode === "sentences" ? "" : "none";
  const folderInput = el("input", {
    class: "input",
    type: "text",
    value: folderName,
    onchange: () => {
      folderName = folderInput.value.trim() || "YouTube";
      void setPrefs({ folderName });
    }
  });
  const keySupadata = el("input", {
    class: "input",
    type: "password",
    value: settings?.supadataApiKey || "",
    placeholder: "Supadata",
    onchange: async () => {
      await setPrefs({ supadataApiKey: keySupadata.value.trim() });
      settings = settingsFromPrefs(await getPrefs());
    }
  });
  const keyGemini = el("input", {
    class: "input",
    type: "password",
    value: settings?.geminiApiKey || "",
    placeholder: "Gemini",
    onchange: async () => {
      await setPrefs({ geminiApiKey: keyGemini.value.trim() });
      settings = settingsFromPrefs(await getPrefs());
    }
  });
  const keyGroq = el("input", {
    class: "input",
    type: "password",
    value: settings?.groqApiKey || "",
    placeholder: "Groq",
    onchange: async () => {
      await setPrefs({ groqApiKey: keyGroq.value.trim() });
      settings = settingsFromPrefs(await getPrefs());
    }
  });
  const errEl = el("p", { class: "error" }, error);
  errEl.style.display = error ? "" : "none";
  const goBtn = el(
    "button",
    {
      class: "btn primary",
      disabled: !videoUrl,
      onclick: () => void runImport()
    },
    t("form.generate")
  );
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
  );
}
function renderProgress(text) {
  const statusEl = el("p", null, text);
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
            cancelled = true;
            renderForm();
          }
        },
        t("progress.cancel")
      )
    ])
  );
  return (next) => {
    statusEl.textContent = next;
  };
}
async function runImport() {
  cancelled = false;
  if (!videoUrl || !parseYouTubeId(videoUrl)) {
    renderForm(t("form.badUrl"));
    return;
  }
  folderName = folderName.trim() || "YouTube";
  if (!hasSupadataApiKey(settings)) {
    renderForm(t("form.needSupadata"));
    return;
  }
  if (!hasGenerateApiKey(settings)) {
    renderForm(t("form.needLlm"));
    return;
  }
  const setStatus = renderProgress(t("progress.fetchVideo"));
  try {
    const { video, transcript } = await fetchTranscriptFromUrl(videoUrl, settings, {
      isClosed: () => cancelled,
      onStatus: setStatus
    });
    if (cancelled) return;
    videoId = video.videoId || parseYouTubeId(videoUrl);
    if (video.title) videoTitle = String(video.title);
    setStatus(t("progress.generate"));
    const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues });
    const gen = await generateYoutubeCards(
      { video, transcript: prepared, mode, settings },
      { isClosed: () => cancelled }
    );
    if (cancelled) return;
    setStatus(mode === "sentences" ? t("progress.checkSentences") : t("progress.checkWords"));
    const known = await loadKnownTermsForImport();
    if (cancelled) return;
    if (mode === "sentences") {
      previewItems = filterNewSentences(gen.cards || [], known).map((cand) => ({
        cand,
        checked: true,
        back: cand.back || ""
      }));
    } else {
      const { phrases, words } = filterNewCandidates(gen.cards || [], known);
      const list = mode === "words" ? words : mode === "phrases" ? phrases : [...phrases, ...words];
      previewItems = list.map((cand) => ({
        cand,
        checked: true,
        back: cand.back || ""
      }));
    }
    if (!previewItems.length) {
      renderForm(t("form.empty"));
      return;
    }
    renderPreview();
  } catch (e) {
    if (cancelled) return;
    renderForm(e instanceof Error ? e.message : String(e));
  }
}
function renderPreview() {
  const groups = /* @__PURE__ */ new Map();
  for (const item of previewItems) {
    const kind = item.cand.kind === "sentence" ? t("preview.group.sentences") : item.cand.kind === "phrase" ? t("preview.group.phrases") : t("preview.group.words");
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(item);
  }
  const list = el("div", { class: "preview-list" }, []);
  for (const [label, items] of groups) {
    list.append(el("h3", null, label));
    for (const item of items) {
      const chk = el("input", {
        type: "checkbox",
        checked: item.checked,
        onchange: () => {
          item.checked = chk.checked;
          countLabel.textContent = t("preview.selected", {
            n: previewItems.filter((i) => i.checked).length
          });
        }
      });
      const back = el("input", {
        class: "input",
        type: "text",
        value: item.back,
        onchange: () => {
          item.back = back.value;
        }
      });
      list.append(
        el("div", { class: "preview-row" }, [
          chk,
          el("div", null, [el("b", null, item.cand.front || ""), back])
        ])
      );
    }
  }
  const countLabel = el(
    "span",
    null,
    t("preview.selected", { n: previewItems.filter((i) => i.checked).length })
  );
  const toast = el("p", { class: "toast", style: "display:none" }, "");
  const saveBtn = el(
    "button",
    {
      class: "btn primary",
      onclick: () => void saveSelected(saveBtn, toast, countLabel)
    },
    t("preview.create")
  );
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
  );
}
async function saveSelected(saveBtn, toast, countLabel) {
  const selected = previewItems.filter((i) => i.checked && i.back.trim()).map((i) => ({ cand: i.cand, back: i.back.trim() }));
  if (!selected.length) return;
  saveBtn.disabled = true;
  toast.style.display = "none";
  try {
    const { ok, json } = buildImportPayload(folderName || defaultExportFolder().name, selected, videoId);
    downloadTextFile(`kar-youtube-${Date.now()}.json`, json);
    toast.className = "toast";
    toast.style.display = "";
    toast.textContent = t("save.exported", { ok });
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
    );
    countLabel.textContent = t("save.exported", { ok });
  } catch (e) {
    toast.className = "toast error";
    toast.style.display = "";
    toast.textContent = e instanceof Error ? e.message : String(e);
    saveBtn.disabled = false;
  }
}
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.kar_ext_video) {
    const v = changes.kar_ext_video.newValue;
    if (v?.url) {
      videoUrl = v.url;
      if (v.title) videoTitle = v.title;
      const urlEl = root.querySelector(".video-url");
      const titleEl = root.querySelector(".video-title");
      if (urlEl) urlEl.textContent = videoUrl;
      if (titleEl && videoTitle) titleEl.textContent = videoTitle;
    }
  }
});
void boot();
//# sourceMappingURL=sidepanel.js.map
