// Кто вызывает /api/* — «субъект» запроса.
//
// Субъект выводится ТОЛЬКО из того, чему можно верить:
//   • проверенный access-token Supabase → `u:<uid>`;
//   • иначе — IP вызывающего + непрозрачный client id → `anon:<sha256hex>`.
//
// userId из тела/квери запроса не используется НИКОГДА: клиент мог прислать
// чужой UUID и читать чужие KV-джобы (см. функцию makeJobKey в _kv.js).

/** X-Client-Id длиннее этого считаем мусором и игнорируем. */
const MAX_CLIENT_ID = 128;

/** Формат uid у Supabase — UUID, но не завязываемся жёстко на версию. */
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** `u:<uid>` или `anon:<64 hex>` — только эти два вида субъектов. */
export const SUBJECT_RE = /^(?:u:[A-Za-z0-9_-]{1,64}|anon:[0-9a-f]{64})$/;

export function isSubject(raw) {
  return SUBJECT_RE.test(String(raw || ''));
}

/** Заголовок из Headers | обычного объекта (для тестов). */
function header(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '');
  const lower = String(name).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return String(headers[key] ?? '');
  }
  return '';
}

/** IP вызывающего: CF-Connecting-IP → первый x-forwarded-for → 'unknown'. */
export function clientIp(headers) {
  const cf = header(headers, 'CF-Connecting-IP').trim();
  if (cf) return cf;
  const first = header(headers, 'x-forwarded-for').split(',')[0].trim();
  return first || 'unknown';
}

/** X-Client-Id — непрозрачный uuid из localStorage. Нет / слишком длинный → ''. */
export function clientId(headers) {
  const raw = header(headers, 'X-Client-Id').trim();
  if (!raw || raw.length > MAX_CLIENT_ID) return '';
  return raw;
}

/** Токен из `Authorization: Bearer <token>`; '' — если заголовка нет. */
export function bearerToken(headers) {
  const m = /^Bearer\s+(\S+)$/i.exec(header(headers, 'Authorization').trim());
  return m ? m[1] : '';
}

export async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(String(input));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Проверенный uid Supabase → субъект. '' — если uid неожиданного формата. */
export function userSubject(userId) {
  const uid = String(userId || '').trim();
  return USER_ID_RE.test(uid) ? `u:${uid}` : '';
}

/** IP + client id → стабильный анонимный субъект (сырой IP в KV не попадает). */
export async function anonSubject(ip, cid) {
  return 'anon:' + (await sha256Hex(`${String(ip || 'unknown')}|${String(cid || '')}`));
}

/** Анонимный субъект прямо из запроса (fallback, если middleware не отработал). */
export async function subjectFromRequest(request) {
  const headers = request?.headers;
  return anonSubject(clientIp(headers), clientId(headers));
}

/** Ключ для per-IP лимита: сырой IP не храним, только его хеш. */
export async function ipBucket(ip) {
  return 'ip:' + (await sha256Hex(String(ip || 'unknown')));
}
