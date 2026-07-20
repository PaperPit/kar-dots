export interface DayRecord {
  visit?: boolean
  reviews?: number
  known?: number
  failed?: number
}

export interface ActivityData {
  days: { [key: string]: DayRecord }
}

export interface ReviewSplit {
  known?: number
  failed?: number
}

const LS_KEY = "kar_activity";
const IDB_NAME = "kartochki_activity";
const IDB_KEY = "data";

let cache: ActivityData | null = null;
let idbReady: Promise<IDBDatabase | null> | null = null;

function readWebStore(store: Storage): ActivityData | null {
  try {
    const raw = store.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.days === "object") return data;
  } catch (e) {}
  return null;
}

function readLegacyStores(): ActivityData | null {
  return readWebStore(localStorage) || readWebStore(sessionStorage);
}

function mergeDay(a: DayRecord | undefined, b: DayRecord | undefined): DayRecord {
  const out: DayRecord = {
    visit: !!(a?.visit || b?.visit),
    reviews: Math.max(a?.reviews || 0, b?.reviews || 0)
  }
  const known = Math.max(a?.known || 0, b?.known || 0)
  const failed = Math.max(a?.failed || 0, b?.failed || 0)
  if (known) out.known = known
  if (failed) out.failed = failed
  return out
}

/** Слить два снимка активности (по дням берём максимумы — для синка устройств). */
export function mergeActivity(a: ActivityData | null, b: ActivityData | null): ActivityData {
  if (!a) return b ? { days: { ...b.days } } : { days: {} };
  if (!b) return { days: { ...a.days } };
  const days = { ...a.days };
  for (const k of Object.keys(b.days || {})) {
    days[k] = mergeDay(days[k], b.days[k]);
  }
  return { days };
}

function openActivityDB() {
  if (!idbReady) {
    idbReady = new Promise<IDBDatabase | null>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => null);
  }
  return idbReady;
}

async function idbLoad(): Promise<ActivityData | null> {
  const db = await openActivityDB();
  if (!db) return null;
  return new Promise<ActivityData | null>((resolve) => {
    const req = db.transaction("kv", "readonly").objectStore("kv").get(IDB_KEY);
    req.onsuccess = () => {
      if (!req.result) {
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(req.result);
        resolve(data && typeof data.days === "object" ? data : null);
      } catch (e) {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  });
}

async function idbSave(data: ActivityData): Promise<void> {
  const db = await openActivityDB();
  if (!db) return;
  return new Promise<void>((resolve) => {
    const t = db.transaction("kv", "readwrite");
    t.objectStore("kv").put(JSON.stringify(data), IDB_KEY);
    t.oncomplete = () => resolve(undefined);
    t.onerror = () => {};
  }).catch((e: unknown) => { console.warn("activity idb save", e); });
}

function ensureCacheFromLegacy() {
  if (!cache) cache = readLegacyStores() || { days: {} };
}

type ActivityCloudSyncFn = (data: ActivityData) => void
let cloudSyncFn: ActivityCloudSyncFn | null = null
/** CloudStore вешает сюда отправку activity в settings; LocalStore — null. */
export function setActivityCloudSync(fn: ActivityCloudSyncFn | null): void {
  cloudSyncFn = fn
}

/** Загрузить и слить активность из IndexedDB и localStorage. Вызывается при старте. */
export async function initActivity(): Promise<ActivityData> {
  const [idb, legacy] = await Promise.all([idbLoad(), Promise.resolve(readLegacyStores())]);
  cache = mergeActivity(idb, legacy);
  await persistActivity(cache, { skipCloud: true });
  return cache;
}

async function persistActivity(data: ActivityData, opts: { skipCloud?: boolean } = {}): Promise<void> {
  cache = data;
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(LS_KEY, json);
  } catch (e) {
    console.warn("activity localStorage", e);
  }
  try {
    sessionStorage.setItem(LS_KEY, json);
  } catch (e) {}
  await idbSave(data);
  if (!opts.skipCloud && cloudSyncFn) {
    try { cloudSyncFn(data); } catch (e) { console.warn("activity cloud sync", e); }
  }
}

export function loadActivity(): ActivityData {
  ensureCacheFromLegacy();
  return JSON.parse(JSON.stringify(cache)) as ActivityData;
}

export async function saveActivity(data: ActivityData): Promise<void> {
  await persistActivity(data);
}

/** Применить activity из облака (merge) без обратной отправки. */
export async function applyRemoteActivity(remote: ActivityData | null | undefined): Promise<boolean> {
  if (!remote || typeof remote.days !== "object") return false;
  ensureCacheFromLegacy();
  const before = JSON.stringify(cache);
  cache = mergeActivity(cache, remote);
  if (JSON.stringify(cache) === before) return false;
  await persistActivity(cache, { skipCloud: true });
  return true;
}

export function dayKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function touchDay(data: ActivityData, key: string): void {
  if (!data.days[key]) data.days[key] = {};
  data.days[key].visit = true;
}

/** День засчитывается в серию: был заход или хотя бы одно повторение. */
export function dayHasActivity(data: ActivityData, key: string): boolean {
  const day = data.days[key];
  if (!day) return false;
  return !!day.visit || (day.reviews || 0) > 0;
}

export async function recordVisit(): Promise<ActivityData> {
  const data = loadActivity();
  touchDay(data, dayKey());
  await saveActivity(data);
  return data;
}

export async function recordReview(count: number = 1, split?: ReviewSplit): Promise<ActivityData> {
  const data = loadActivity();
  const k = dayKey();
  touchDay(data, k);
  const dayRecord = data.days[k]!;
  dayRecord.reviews = (dayRecord.reviews || 0) + count;
  const knownAdd = split?.known ?? 0;
  const failedAdd = split?.failed ?? 0;
  if (knownAdd) dayRecord.known = (dayRecord.known || 0) + knownAdd;
  if (failedAdd) dayRecord.failed = (dayRecord.failed || 0) + failedAdd;
  await saveActivity(data);
  return data;
}

export async function undoReview(count: number = 1, split?: ReviewSplit): Promise<ActivityData> {
  const data = loadActivity();
  const k = dayKey();
  if (data.days[k]) {
    data.days[k].reviews = Math.max(0, (data.days[k].reviews || 0) - count);
    if (split?.known) {
      data.days[k].known = Math.max(0, (data.days[k].known || 0) - split.known);
    }
    if (split?.failed) {
      data.days[k].failed = Math.max(0, (data.days[k].failed || 0) - split.failed);
    }
  }
  await saveActivity(data);
  return data;
}

/** Известные / проваленные за день. Legacy без split: все reviews → known. */
export function dayKnownFailed(day: DayRecord | undefined): { known: number; failed: number } {
  if (!day) return { known: 0, failed: 0 };
  const hasSplit = day.known != null || day.failed != null;
  if (hasSplit) {
    return { known: day.known || 0, failed: day.failed || 0 };
  }
  return { known: day.reviews || 0, failed: 0 };
}

/** Уровень «жара» 0–3 по числу повторений за день. */
export function dayHeatLevel(reviews: number): 0 | 1 | 2 | 3 {
  if (reviews <= 0) return 0;
  if (reviews <= 5) return 1;
  if (reviews <= 15) return 2;
  return 3;
}

export function calcVisitStreak(data: ActivityData): number {
  const d = new Date();
  if (!dayHasActivity(data, dayKey(d))) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (dayHasActivity(data, dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export interface CalendarCell {
  day?: number;
  outside?: boolean;
  key: string;
}

export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells: CalendarCell[] = [];
  const prevLast = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const day = prevLast - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ day, outside: true, key: dayKey(new Date(py, pm, day)) });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      day,
      outside: false,
      key: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    });
  }
  let nextDay = 1;
  const nm = month === 11 ? 0 : month + 1;
  const ny = month === 11 ? year + 1 : year;
  while (cells.length % 7 !== 0) {
    const day = nextDay++;
    cells.push({ day, outside: true, key: dayKey(new Date(ny, nm, day)) });
  }
  return cells;
}

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
];

export const WEEKDAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
