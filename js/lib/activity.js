const LS_KEY = 'kar_activity';
const IDB_NAME = 'kartochki_activity';
const IDB_KEY = 'data';

let cache = null;
let idbReady = null;

function readWebStore(store) {
  try {
    const raw = store.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data.days === 'object') return data;
  } catch (e) {}
  return null;
}

function readLegacyStores() {
  return readWebStore(localStorage) || readWebStore(sessionStorage);
}

function mergeDay(a, b) {
  return {
    visit: !!(a?.visit || b?.visit),
    reviews: Math.max(a?.reviews || 0, b?.reviews || 0),
  };
}

function mergeActivity(a, b) {
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
    idbReady = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch(() => null);
  }
  return idbReady;
}

async function idbLoad() {
  const db = await openActivityDB();
  if (!db) return null;
  return new Promise(resolve => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get(IDB_KEY);
    req.onsuccess = () => {
      if (!req.result) { resolve(null); return; }
      try {
        const data = JSON.parse(req.result);
        resolve(data && typeof data.days === 'object' ? data : null);
      } catch (e) { resolve(null); }
    };
    req.onerror = () => resolve(null);
  });
}

async function idbSave(data) {
  const db = await openActivityDB();
  if (!db) return;
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', 'readwrite');
    t.objectStore('kv').put(JSON.stringify(data), IDB_KEY);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  }).catch(e => console.warn('activity idb save', e));
}

function ensureCacheFromLegacy() {
  if (!cache) cache = readLegacyStores() || { days: {} };
}

/** Загрузить и слить активность из IndexedDB и localStorage. Вызывается при старте. */
export async function initActivity() {
  const [idb, legacy] = await Promise.all([
    idbLoad(),
    Promise.resolve(readLegacyStores()),
  ]);
  cache = mergeActivity(idb, legacy);
  await persistActivity(cache);
  return cache;
}

async function persistActivity(data) {
  cache = data;
  const json = JSON.stringify(data);
  try { localStorage.setItem(LS_KEY, json); } catch (e) { console.warn('activity localStorage', e); }
  try { sessionStorage.setItem(LS_KEY, json); } catch (e) {}
  await idbSave(data);
}

export function loadActivity() {
  ensureCacheFromLegacy();
  return JSON.parse(JSON.stringify(cache));
}

export async function saveActivity(data) {
  await persistActivity(data);
}

export function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function touchDay(data, key) {
  if (!data.days[key]) data.days[key] = {};
  data.days[key].visit = true;
}

/** День засчитывается в серию: был заход или хотя бы одно повторение. */
export function dayHasActivity(data, key) {
  const day = data.days[key];
  if (!day) return false;
  return !!day.visit || (day.reviews || 0) > 0;
}

export async function recordVisit() {
  const data = loadActivity();
  touchDay(data, dayKey());
  await saveActivity(data);
  return data;
}

export async function recordReview(count = 1) {
  const data = loadActivity();
  const k = dayKey();
  touchDay(data, k);
  data.days[k].reviews = (data.days[k].reviews || 0) + count;
  await saveActivity(data);
  return data;
}

export function calcVisitStreak(data) {
  const d = new Date();
  if (!dayHasActivity(data, dayKey(d))) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (dayHasActivity(data, dayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells = [];
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
      key: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
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
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
