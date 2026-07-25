"use strict";
(() => {
  // src/lib/constants.ts
  var APP_ORIGIN = "https://kar-tochki.pages.dev";
  var CONNECT_URL = `${APP_ORIGIN}/?ext_connect=1`;
  var STORAGE_KEYS = {
    auth: "kar_ext_auth",
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
    folderId: null
  };

  // src/lib/storage.ts
  async function getAuth() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.auth);
    return data[STORAGE_KEYS.auth] || null;
  }
  async function setAuth(auth) {
    if (auth) await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
    else await chrome.storage.local.remove(STORAGE_KEYS.auth);
  }
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
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.video);
      return data[STORAGE_KEYS.video] || null;
    } catch {
      return null;
    }
  }

  // src/lib/supabase-client.ts
  var RequestError = class extends Error {
    status;
  };
  function authError(data) {
    return new Error(data.message || data.error_description || data.error || data.msg || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438");
  }
  function withExpiry(data) {
    const expires_in = Number(data.expires_in) || 3600;
    return {
      ...data,
      expires_at_ms: Date.now() + expires_in * 1e3
    };
  }
  var ExtSupabase = class _ExtSupabase {
    url;
    key;
    session;
    constructor(auth) {
      this.url = auth.supabaseUrl.replace(/\/+$/, "");
      this.key = auth.anonKey;
      this.session = auth.session;
    }
    static async fromStorage() {
      const auth = await getAuth();
      if (!auth?.session?.access_token || !auth.supabaseUrl || !auth.anonKey) return null;
      return new _ExtSupabase(auth);
    }
    headers() {
      return {
        apikey: this.key,
        Authorization: "Bearer " + (this.session?.access_token || this.key)
      };
    }
    userId() {
      return this.session?.user?.id ?? null;
    }
    email() {
      return this.session?.user?.email || null;
    }
    async ensureFresh() {
      if (!this.session?.access_token) return false;
      const exp = this.session.expires_at_ms;
      if (exp && Date.now() > exp - 2 * 60 * 1e3) {
        try {
          await this.refresh();
        } catch {
          return false;
        }
      }
      return true;
    }
    async refresh() {
      if (!this.session?.refresh_token) throw new Error("\u041D\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0438");
      const r = await fetch(this.url + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.key },
        body: JSON.stringify({ refresh_token: this.session.refresh_token })
      });
      const data = await r.json();
      if (!r.ok) {
        await setAuth(null);
        this.session = null;
        throw authError(data);
      }
      this.session = withExpiry(data);
      const prev = await getAuth();
      if (prev) {
        await setAuth({
          ...prev,
          session: this.session,
          connectedAt: prev.connectedAt
        });
      }
    }
    async handle(r) {
      if (r.status === 204) return null;
      const text = await r.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!r.ok) {
        const err = new RequestError(
          data?.message || r.statusText || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430"
        );
        err.status = r.status;
        throw err;
      }
      return data;
    }
    async select(table, query) {
      if (!await this.ensureFresh()) throw new Error("\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430 \u2014 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0441\u043D\u043E\u0432\u0430");
      const r = await fetch(this.url + "/rest/v1/" + table + (query ? "?" + query : ""), {
        headers: this.headers()
      });
      return await this.handle(r);
    }
    async insert(table, row) {
      if (!await this.ensureFresh()) throw new Error("\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430 \u2014 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0441\u043D\u043E\u0432\u0430");
      const r = await fetch(this.url + "/rest/v1/" + table, {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(row)
      });
      return this.handle(r);
    }
  };

  // ../js/lib/vocab-packs.ts
  function isVocabPackFolder(folder) {
    return !!folder?.pack_id;
  }

  // src/lib/folders.ts
  async function listImportFolders(sb) {
    const rows = await sb.select("folders", "select=id,name,pack_id&order=created_at.asc");
    return rows.filter((f) => f?.id && f?.name && !isVocabPackFolder(f)).map((f) => ({ id: f.id, name: f.name }));
  }
  async function loadUserSettings(sb) {
    const uid = sb.userId();
    if (!uid) return null;
    const rows = await sb.select("settings", "select=data&user_id=eq." + uid);
    return rows[0]?.data || null;
  }

  // ../js/lib/llm-api-keys.ts
  function strip(raw) {
    return String(raw || "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim().replace(/\s+/g, "");
  }
  var GEMINI_KEY_RE = /^(?:AIza[A-Za-z0-9_-]{10,}|AQ\.[A-Za-z0-9._-]{20,})$/;
  function cleanGeminiApiKey(raw) {
    const s = strip(raw);
    if (!s) return "";
    if (GEMINI_KEY_RE.test(s)) return s.slice(0, 512);
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
    if (!s) return "";
    if (/^gsk_[A-Za-z0-9_-]{10,200}$/.test(s)) return s;
    if (/^[A-Za-z0-9_-]{20,200}$/.test(s)) return s;
    return "";
  }
  function cleanSupadataApiKey(raw) {
    const s = strip(raw);
    if (!s) return "";
    if (/^sd_[A-Za-z0-9_-]{10,200}$/.test(s)) return s;
    if (/^[A-Za-z0-9_-]{16,200}$/.test(s)) return s;
    return "";
  }

  // ../js/lib/youtube-import-settings.ts
  function getSupadataApiKey(settings2) {
    return cleanSupadataApiKey(settings2?.supadataApiKey || "");
  }
  function hasSupadataApiKey(settings2) {
    return getSupadataApiKey(settings2).length > 0;
  }
  function getGeminiApiKey(settings2) {
    return cleanGeminiApiKey(settings2?.geminiApiKey || "");
  }
  function getGroqApiKey(settings2) {
    return cleanGroqApiKey(settings2?.groqApiKey || "");
  }
  function withApiKeys(settings2, body) {
    const out = { ...body };
    const supadata = getSupadataApiKey(settings2);
    if (supadata) out.supadataApiKey = supadata;
    const gemini = getGeminiApiKey(settings2);
    if (gemini) out.geminiApiKey = gemini;
    const groq = getGroqApiKey(settings2);
    if (groq) out.groqApiKey = groq;
    return out;
  }

  // ../js/lib/yt-segment-merge.ts
  var DEFAULT_MAX_CHARS = 120;
  function countWords(text) {
    const s = String(text || "").trim();
    if (!s) return 0;
    return s.split(/\s+/).filter(Boolean).length;
  }
  function endsSentence(text) {
    return /[.!?…]["')\]]*$/.test(String(text || "").trim());
  }
  function mergeCaptionSegments(segments, { maxChars = DEFAULT_MAX_CHARS } = {}) {
    const out = [];
    let buf = null;
    const flush = () => {
      if (buf?.text?.trim()) out.push(buf);
      buf = null;
    };
    for (const s of segments || []) {
      const text = String(s?.text || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const t = Math.max(0, Math.round(Number(s?.t) || 0));
      const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : null;
      if (!buf) {
        buf = { t, text, end: end ?? t };
        if (endsSentence(text) || text.length >= maxChars) flush();
        continue;
      }
      const joined = buf.text + " " + text;
      if (joined.length > maxChars && buf.text) {
        flush();
        buf = { t, text, end: end ?? t };
        if (endsSentence(text) || text.length >= maxChars) flush();
      } else {
        buf.text = joined;
        buf.end = end ?? t;
        if (endsSentence(joined) || joined.length >= maxChars) flush();
      }
    }
    flush();
    return out;
  }

  // ../js/lib/youtube-import.ts
  var ID_PATTERNS = [
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/
  ];
  function parseYouTubeId(url) {
    const s = String(url || "").trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    for (const re of ID_PATTERNS) {
      const m = s.match(re);
      if (m) return m[1];
    }
    return null;
  }
  function normalizeTerm(s) {
    return String(s || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
  }
  function stemVariants(word) {
    const w = normalizeTerm(word);
    const out = /* @__PURE__ */ new Set([w]);
    if (!w || w.includes(" ")) return out;
    const add = (v) => {
      if (v && v.length > 1) out.add(v);
    };
    if (w.endsWith("ies") && w.length > 4) add(w.slice(0, -3) + "y");
    if (w.endsWith("es") && w.length > 3) add(w.slice(0, -2));
    if (w.endsWith("s") && !w.endsWith("ss")) add(w.slice(0, -1));
    if (w.endsWith("ing") && w.length > 5) {
      const base = w.slice(0, -3);
      add(base);
      add(base + "e");
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) add(base.slice(0, -1));
    }
    if (w.endsWith("ied") && w.length > 4) add(w.slice(0, -3) + "y");
    if (w.endsWith("ed") && w.length > 4) {
      const base = w.slice(0, -2);
      add(base);
      add(w.slice(0, -1));
      if (base.length > 2 && base[base.length - 1] === base[base.length - 2]) add(base.slice(0, -1));
    }
    out.delete("");
    return out;
  }
  function isKnownTerm(term, knownSet) {
    const n = normalizeTerm(term);
    if (!n) return true;
    if (knownSet.has(n)) return true;
    if (!n.includes(" ")) {
      for (const v of stemVariants(n)) if (knownSet.has(v)) return true;
    }
    return false;
  }
  function collectKnownTerms(cardArrays) {
    const known = /* @__PURE__ */ new Set();
    for (const cards of cardArrays || []) {
      for (const c of cards || []) {
        const n = normalizeTerm(c && c.front);
        if (n) known.add(n);
      }
    }
    return known;
  }
  function isYoutubeCard(card) {
    return /youtube\.com\/watch\?v=/.test(String(card?.description || ""));
  }
  function filterNewCandidates(candidates, knownSet) {
    const seen = /* @__PURE__ */ new Set();
    const phrases = [];
    const words = [];
    for (const c of candidates || []) {
      const n = normalizeTerm(c && c.front);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      if (c.kind === "phrase") {
        if (!knownSet.has(n)) phrases.push(c);
      } else {
        words.push(c);
      }
    }
    const coveredByPhrases = /* @__PURE__ */ new Set();
    for (const p of phrases) {
      for (const token of normalizeTerm(p.front).split(" ")) {
        for (const v of stemVariants(token)) coveredByPhrases.add(v);
        coveredByPhrases.add(token);
      }
    }
    const newWords = words.filter((w) => {
      const n = normalizeTerm(w.front);
      if (isKnownTerm(n, knownSet)) return false;
      if (coveredByPhrases.has(n)) return false;
      for (const v of stemVariants(n)) if (coveredByPhrases.has(v)) return false;
      return true;
    });
    return { phrases, words: newWords };
  }
  function filterTranscriptSegments(segments, { minWords = 3, dedupe = true } = {}) {
    const seen = dedupe ? /* @__PURE__ */ new Set() : null;
    const out = [];
    for (const s of segments || []) {
      const text = String(s?.text || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (minWords > 0 && countWords(text) < minWords) continue;
      if (seen) {
        const n = normalizeTerm(text);
        if (!n || seen.has(n)) continue;
        seen.add(n);
      }
      const t = Math.max(0, Math.round(Number(s?.t) || 0));
      const end = Number.isFinite(Number(s?.end)) ? Math.max(0, Math.round(Number(s?.end))) : void 0;
      out.push(end != null ? { t, text, end } : { t, text });
    }
    return out;
  }
  function filterNewSentences(candidates, knownSet) {
    const seen = /* @__PURE__ */ new Set();
    const sentences = [];
    for (const c of candidates || []) {
      const n = normalizeTerm(c && c.front);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      if (!knownSet.has(n)) sentences.push(c);
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
  function buildYtLink(videoId2, t) {
    const sec = Math.max(0, Math.floor(Number(t) || 0) - LINK_LEAD_SEC);
    return `https://www.youtube.com/watch?v=${videoId2}&t=${sec}s`;
  }
  function buildCardDescription(candidate, videoId2) {
    const parts = [];
    if (candidate.level) parts.push(candidate.level);
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
  async function apiJson(path, opts) {
    let res;
    try {
      res = await fetch(APP_ORIGIN + path, opts);
    } catch {
      throw new Error("\u041D\u0435\u0442 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
    }
    if (!res.ok || !data || data.error) {
      throw new Error(data && data.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430 (" + res.status + ")");
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
    let data = await apiJson("/api/yt-video", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withApiKeys(settings2, { url }))
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
        data = await apiJson("/api/yt-video?jobId=" + encodeURIComponent(String(data.jobId)));
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
    if (mergeCues2) segments = mergeCaptionSegments(segments);
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
  async function loadPackSources() {
    const sources = [];
    try {
      const res = await fetch(APP_ORIGIN + "/packs/manifest.json", { cache: "no-cache" });
      if (!res.ok) return sources;
      const manifest = await res.json();
      for (const meta of manifest.packs || []) {
        try {
          const pr = await fetch(APP_ORIGIN + "/packs/" + meta.file, { cache: "no-cache" });
          if (!pr.ok) continue;
          const data = await pr.json();
          sources.push(data.cards || []);
        } catch {
        }
      }
    } catch {
    }
    return sources;
  }
  async function folderFronts(sb, folderId2, youtubeOnly) {
    const rows = await sb.select(
      "cards",
      "select=front,description&folder_id=eq." + encodeURIComponent(folderId2)
    );
    return rows.filter((c) => c.front && (!youtubeOnly || isYoutubeCard(c))).map((c) => ({ front: c.front, description: c.description }));
  }
  async function loadKnownTermsForImport(sb, folders2, folderId2) {
    const sources = await loadPackSources();
    for (const f of folders2) {
      try {
        sources.push(await folderFronts(sb, f.id, f.id !== folderId2));
      } catch {
      }
    }
    return collectKnownTerms(sources);
  }

  // src/lib/create-cards.ts
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : r & 3 | 8).toString(16);
    });
  }
  function buildCardRow(data, userId) {
    const t = Date.now();
    return {
      id: uuid(),
      created_at: t,
      updated_at: t,
      front: data.front,
      back: data.back,
      description: data.description,
      front_img: null,
      back_img: null,
      folder_id: data.folder_id,
      user_id: userId,
      sm2_ef: 2.5,
      sm2_reps: 0,
      sm2_ivl: 0,
      sm2_due: null,
      box: 0,
      box_due: null,
      fsrs_state: null,
      fsrs_stability: null,
      fsrs_difficulty: null,
      fsrs_due: null,
      fsrs_scheduled_days: null,
      fsrs_elapsed_days: null,
      fsrs_reps: null,
      fsrs_lapses: null,
      fsrs_learning_steps: null,
      fsrs_last_review: null
    };
  }
  async function createYoutubeCardsBatch(sb, folderId2, selected, videoId2) {
    const uid = sb.userId();
    if (!uid) throw new Error("\u041D\u0435\u0442 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F");
    let ok = 0;
    const failed = [];
    for (const { cand, back } of selected) {
      const text = String(back || "").trim();
      if (!text) continue;
      try {
        const row = buildCardRow(
          {
            folder_id: folderId2,
            front: cand.front || "",
            back: text,
            description: buildCardDescription(cand, videoId2)
          },
          uid
        );
        await sb.insert("cards", row);
        ok++;
      } catch (e) {
        const err = e;
        failed.push({ front: cand.front || "", message: err.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F" });
      }
    }
    return { ok, failed };
  }

  // src/sidepanel/sidepanel.ts
  var root = null;
  var mounted = false;
  var cancelled = false;
  var mode = "both";
  var mergeCues = true;
  var folderId = null;
  var folders = [];
  var settings = null;
  var videoUrl = "";
  var videoTitle = "";
  var previewItems = [];
  var videoId = null;
  var accountEmail = null;
  function requireRoot() {
    if (!root) throw new Error("\u041F\u0430\u043D\u0435\u043B\u044C \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438 \u043D\u0435 \u0441\u043C\u043E\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0430");
    return root;
  }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
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
    const kids = Array.isArray(children) ? children : [children];
    for (const c of kids) {
      if (c == null || c === false) continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  function brand() {
    return el("div", { class: "brand" }, [
      el("div", { class: "brand-mark" }, "\u041A"),
      el("div", {}, [el("h1", {}, "\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438"), el("p", {}, "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u0437 YouTube")])
    ]);
  }
  async function refreshVideoFromStorage() {
    const v = await getVideo();
    if (v?.url) {
      videoUrl = v.url;
      videoTitle = v.title || videoTitle;
    }
    if (!videoUrl) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab?.url && /youtube\.com\/(watch|shorts)/.test(tab.url)) {
          videoUrl = tab.url;
          videoTitle = (tab.title || "").replace(/ - YouTube$/, "");
        }
      } catch {
      }
    }
  }
  async function boot() {
    try {
      const prefs = await getPrefs();
      mode = prefs.mode;
      mergeCues = prefs.mergeCues;
      folderId = prefs.folderId;
    } catch {
    }
    try {
      await refreshVideoFromStorage();
    } catch {
    }
    const auth = await getAuth().catch(() => null);
    if (!auth) {
      renderAuth();
      return;
    }
    try {
      const sb = await ExtSupabase.fromStorage();
      if (!sb || !await sb.ensureFresh()) {
        await setAuth(null);
        renderAuth("\u0421\u0435\u0441\u0441\u0438\u044F \u0438\u0441\u0442\u0435\u043A\u043B\u0430 \u2014 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0441\u043D\u043E\u0432\u0430");
        return;
      }
      accountEmail = sb.email();
      folders = await listImportFolders(sb);
      settings = await loadUserSettings(sb);
      if (folderId && !folders.some((f) => f.id === folderId)) folderId = null;
      if (!folderId && folders[0]) {
        folderId = folders[0].id;
        await setPrefs({ folderId });
      }
      renderForm();
    } catch (e) {
      renderAuth(e instanceof Error ? e.message : String(e));
    }
  }
  function renderAuth(error) {
    requireRoot().replaceChildren(
      brand(),
      el("div", { class: "card auth-box" }, [
        el(
          "p",
          null,
          "\u0427\u0442\u043E\u0431\u044B \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0432 \u0441\u0432\u043E\u044E \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E, \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043D\u0430 kar-tochki.pages.dev."
        ),
        error ? el("p", { class: "error" }, error) : null,
        el("div", { class: "actions", style: "justify-content:center" }, [
          el(
            "button",
            {
              class: "btn primary",
              onclick: () => {
                chrome.runtime.sendMessage({ type: "OPEN_TAB", url: CONNECT_URL }).catch(() => {
                  window.open(CONNECT_URL, "_blank", "noopener,noreferrer");
                });
              }
            },
            "\u0412\u043E\u0439\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438"
          )
        ]),
        el(
          "p",
          { class: "muted" },
          "\u041E\u0442\u043A\u0440\u043E\u0435\u0442\u0441\u044F \u0441\u0430\u0439\u0442 \u2014 \u0432\u043E\u0439\u0434\u0438, \u0435\u0441\u043B\u0438 \u0435\u0449\u0451 \u043D\u0435 \u0432\u043E\u0448\u0451\u043B. \u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u0438\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u0442 \u0441\u0435\u0441\u0441\u0438\u044E \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438."
        )
      ])
    );
  }
  function accountBar() {
    return el("div", { class: "account-row" }, [
      el("span", {}, accountEmail ? `\u0410\u043A\u043A\u0430\u0443\u043D\u0442: ${accountEmail}` : "\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0451\u043D"),
      el(
        "button",
        {
          class: "btn linkish",
          onclick: async () => {
            await setAuth(null);
            accountEmail = null;
            renderAuth();
          }
        },
        "\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C"
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
          mo.label
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
      el("label", { class: "check-label" }, [
        mergeChk,
        el("span", {}, "\u0421\u043A\u043B\u0435\u0438\u0432\u0430\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u0432 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F")
      ])
    ]);
    sentencesOpts.style.display = mode === "sentences" ? "" : "none";
    const folderSelect = el("select", { class: "input" }, []);
    if (!folders.length) {
      folderSelect.append(el("option", { value: "" }, "\u041D\u0435\u0442 \u043F\u0430\u043F\u043E\u043A \u2014 \u0441\u043E\u0437\u0434\u0430\u0439 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438"));
    } else {
      for (const f of folders) {
        folderSelect.append(el("option", { value: f.id, selected: f.id === folderId }, f.name));
      }
    }
    folderSelect.addEventListener("change", () => {
      folderId = folderSelect.value || null;
      void setPrefs({ folderId });
    });
    const errEl = el("p", { class: "error" }, error);
    errEl.style.display = error ? "" : "none";
    const goBtn = el(
      "button",
      {
        class: "btn primary",
        disabled: !folders.length || !videoUrl,
        onclick: () => void runImport()
      },
      "\u0421\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u0442\u044C"
    );
    requireRoot().replaceChildren(
      brand(),
      accountBar(),
      el("div", { class: "card" }, [
        el("p", { class: "video-title" }, videoTitle || "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0432\u0438\u0434\u0435\u043E"),
        el("p", { class: "video-url" }, videoUrl || "\u041E\u0442\u043A\u0440\u043E\u0439 \u0440\u043E\u043B\u0438\u043A \u043D\u0430 YouTube"),
        el("div", { class: "field" }, [el("label", {}, "\u0427\u0442\u043E \u0434\u043E\u0441\u0442\u0430\u0442\u044C \u0438\u0437 \u0440\u043E\u043B\u0438\u043A\u0430"), modeSeg]),
        sentencesOpts,
        el("div", { class: "field" }, [el("label", {}, "\u041F\u0430\u043F\u043A\u0430"), folderSelect]),
        errEl,
        el("div", { class: "actions" }, [goBtn])
      ])
    );
  }
  function renderProgress(text) {
    const statusEl = el("p", {}, text);
    requireRoot().replaceChildren(
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
          "\u041E\u0442\u043C\u0435\u043D\u0430"
        )
      ])
    );
    return (t) => {
      statusEl.textContent = t;
    };
  }
  async function runImport() {
    cancelled = false;
    if (!videoUrl || !parseYouTubeId(videoUrl)) {
      renderForm("\u041D\u0435 \u043F\u043E\u0445\u043E\u0436\u0435 \u043D\u0430 \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 YouTube-\u0432\u0438\u0434\u0435\u043E \u2014 \u043E\u0442\u043A\u0440\u043E\u0439 \u0440\u043E\u043B\u0438\u043A \u043D\u0430 YouTube");
      return;
    }
    if (!folderId) {
      renderForm("\u0412\u044B\u0431\u0435\u0440\u0438 \u043F\u0430\u043F\u043A\u0443");
      return;
    }
    if (!hasSupadataApiKey(settings)) {
      renderForm(
        "\u0423\u043A\u0430\u0436\u0438 Supadata API \u043A\u043B\u044E\u0447 \u0432 \u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438: \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u2192 \xAB\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u0437 YouTube\xBB \u2192 \xAB\u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C\xBB"
      );
      return;
    }
    const setStatus = renderProgress("\u041F\u043E\u043B\u0443\u0447\u0430\u044E \u0434\u0430\u043D\u043D\u044B\u0435 \u0432\u0438\u0434\u0435\u043E\u2026");
    const isClosed = () => cancelled;
    try {
      const sb = await ExtSupabase.fromStorage();
      if (!sb) throw new Error("\u041D\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0438");
      const { video, transcript } = await fetchTranscriptFromUrl(videoUrl, settings, {
        isClosed,
        onStatus: setStatus
      });
      if (cancelled) return;
      videoId = video.videoId || parseYouTubeId(videoUrl);
      if (video.title) videoTitle = String(video.title);
      setStatus("\u0421\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u044E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438\u2026");
      const prepared = prepareTranscriptForMode(transcript, mode, { mergeCues });
      const gen = await generateYoutubeCards(
        { video, transcript: prepared, mode, settings },
        { isClosed }
      );
      if (cancelled) return;
      setStatus(mode === "sentences" ? "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u043D\u043E\u0432\u044B\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u2026" : "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u044E \u043D\u043E\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430\u2026");
      const known = await loadKnownTermsForImport(sb, folders, folderId);
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
        renderForm("\u041D\u043E\u0432\u044B\u0445 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C \u2014 \u0432\u0441\u0451 \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 \u043F\u0430\u043A\u0430\u0445 \u0438\u043B\u0438 \u043F\u0430\u043F\u043A\u0430\u0445");
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
      const kind = item.cand.kind === "sentence" ? "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F" : item.cand.kind === "phrase" ? "\u0424\u0440\u0430\u0437\u044B" : "\u0421\u043B\u043E\u0432\u0430";
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(item);
    }
    const selectedCount = () => previewItems.filter((i) => i.checked && i.back.trim()).length;
    const countLabel = el("span", { class: "muted" }, `\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ${selectedCount()}`);
    const toast = el("div", { class: "toast" }, "");
    toast.style.display = "none";
    const list = el("div", {}, []);
    for (const [title, items] of groups) {
      const groupEl = el("div", { class: "preview-group" }, [el("h3", {}, `${title} (${items.length})`)]);
      for (const item of items) {
        const chk = el("input", { type: "checkbox", checked: item.checked });
        chk.addEventListener("change", () => {
          item.checked = chk.checked;
          countLabel.textContent = `\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ${selectedCount()}`;
          saveBtn.disabled = selectedCount() === 0;
        });
        const back = el("input", { class: "back", value: item.back });
        back.addEventListener("input", () => {
          item.back = back.value;
          countLabel.textContent = `\u0412\u044B\u0431\u0440\u0430\u043D\u043E: ${selectedCount()}`;
          saveBtn.disabled = selectedCount() === 0;
        });
        const metaParts = [
          item.cand.level,
          item.cand.pos || item.cand.kind,
          item.cand.t != null ? fmtTimestamp(item.cand.t) : null
        ].filter(Boolean);
        groupEl.append(
          el("div", { class: "preview-row" }, [
            chk,
            el("div", {}, [
              el("div", { class: "front" }, item.cand.front || ""),
              metaParts.length ? el("div", { class: "meta" }, metaParts.join(" \xB7 ")) : null,
              back
            ])
          ])
        );
      }
      list.append(groupEl);
    }
    const saveBtn = el(
      "button",
      {
        class: "btn primary",
        disabled: selectedCount() === 0,
        onclick: () => void saveSelected(saveBtn, toast, countLabel)
      },
      "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438"
    );
    requireRoot().replaceChildren(
      brand(),
      el("div", { class: "card" }, [
        el("div", { class: "preview-head" }, [
          el("div", {}, [
            el("p", { class: "video-title" }, videoTitle || "\u041F\u0440\u0435\u0432\u044C\u044E"),
            el("p", { class: "muted" }, "\u041E\u0442\u043C\u0435\u0442\u044C, \u0447\u0442\u043E \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C, \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043F\u043E\u043F\u0440\u0430\u0432\u044C \u043F\u0435\u0440\u0435\u0432\u043E\u0434")
          ]),
          countLabel
        ]),
        list,
        toast,
        el("div", { class: "actions" }, [
          el("button", { class: "btn ghost", onclick: () => renderForm() }, "\u041D\u0430\u0437\u0430\u0434"),
          saveBtn
        ])
      ])
    );
  }
  async function saveSelected(saveBtn, toast, countLabel) {
    const selected = previewItems.filter((i) => i.checked && i.back.trim()).map((i) => ({ cand: i.cand, back: i.back.trim() }));
    if (!selected.length || !folderId) return;
    saveBtn.disabled = true;
    toast.style.display = "none";
    try {
      const sb = await ExtSupabase.fromStorage();
      if (!sb) throw new Error("\u041D\u0435\u0442 \u0441\u0435\u0441\u0441\u0438\u0438");
      const { ok, failed } = await createYoutubeCardsBatch(sb, folderId, selected, videoId);
      const folder = folders.find((f) => f.id === folderId);
      toast.className = failed.length && !ok ? "toast error" : "toast";
      toast.style.display = "";
      toast.textContent = ok > 0 ? `\u0421\u043E\u0437\u0434\u0430\u043D\u043E: ${ok}` + (failed.length ? `, \u043E\u0448\u0438\u0431\u043E\u043A: ${failed.length}` : "") : `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C (${failed[0]?.message || "\u043E\u0448\u0438\u0431\u043A\u0430"})`;
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
            folder ? `\u041E\u0442\u043A\u0440\u044B\u0442\u044C \xAB${folder.name}\xBB` : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043F\u043A\u0443"
          )
        );
      }
      countLabel.textContent = `\u0421\u043E\u0437\u0434\u0430\u043D\u043E: ${ok}`;
    } catch (e) {
      toast.className = "toast error";
      toast.style.display = "";
      toast.textContent = e instanceof Error ? e.message : String(e);
      saveBtn.disabled = false;
    }
  }
  function renderFatal(error) {
    const msg = error instanceof Error ? error.message : String(error);
    requireRoot().replaceChildren(
      brand(),
      el("div", { class: "card" }, [
        el("p", { class: "error" }, "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C: " + msg),
        el("p", { class: "muted" }, "\u041E\u0442\u043A\u0440\u043E\u0439 chrome://extensions \u2192 Errors \u0443 \xAB\u041A\u0410\u0420-\u0442\u043E\u0447\u043A\u0438 \u2014 YouTube\xBB."),
        el("div", { class: "actions" }, [
          el(
            "button",
            {
              class: "btn primary",
              onclick: () => {
                void boot().catch(renderFatal);
              }
            },
            "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C"
          )
        ])
      ])
    );
  }
  function onStorageChanged(changes, area) {
    if (!root || area !== "local") return;
    if (changes.kar_ext_auth) void boot().catch(renderFatal);
    if (changes.kar_ext_video) {
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
  }
  function mountKarPanel(container) {
    root = container;
    if (!mounted) {
      chrome.storage.onChanged.addListener(onStorageChanged);
      mounted = true;
    }
    void boot().catch(renderFatal);
  }
  var appEl = document.getElementById("app");
  if (appEl) mountKarPanel(appEl);
})();
