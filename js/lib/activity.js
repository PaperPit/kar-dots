const LS_KEY = 'kar_activity';

export function loadActivity() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.days === 'object') return data;
    }
  } catch (e) {}
  return { days: {} };
}

export function saveActivity(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
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

export function recordVisit() {
  const data = loadActivity();
  touchDay(data, dayKey());
  saveActivity(data);
  return data;
}

export function recordReview(count = 1) {
  const data = loadActivity();
  const k = dayKey();
  touchDay(data, k);
  data.days[k].reviews = (data.days[k].reviews || 0) + count;
  saveActivity(data);
  return data;
}

export function calcVisitStreak(data) {
  const d = new Date();
  const todayK = dayKey(d);
  if (!data.days[todayK]?.visit) d.setDate(d.getDate() - 1);

  let streak = 0;
  while (data.days[dayKey(d)]?.visit) {
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
