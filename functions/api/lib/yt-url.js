// Разбор ссылок на YouTube. Все шаблоны заякорены (^…$): без якорей строка
// вида `https://evil.example/?x=https://youtu.be/dQw4w9WgXcQ` проходила проверку,
// а дальше в апстрим уходил СЫРОЙ url вызывающего (SSRF второго порядка).
// Наружу отдаём только videoId, а URL для апстрима собираем сами.

/** Идентификатор видео YouTube — ровно 11 символов из [A-Za-z0-9_-]. */
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const ID_PATTERNS = [
  // youtube.com/watch?v=<id> (v может быть не первым параметром)
  /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:[&#][\s\S]*)?$/,
  // youtube.com/shorts|embed|live|v/<id>
  /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?youtube(?:-nocookie)?\.com\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#][\s\S]*)?$/,
  // youtu.be/<id>
  /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#][\s\S]*)?$/,
];

export function isVideoId(raw) {
  return VIDEO_ID_RE.test(String(raw || ''));
}

/** Ссылка или голый id → id из 11 символов, иначе null. */
export function parseVideoId(url) {
  const s = String(url || '').trim();
  if (isVideoId(s)) return s;
  for (const re of ID_PATTERNS) {
    const m = re.exec(s);
    if (m && isVideoId(m[1])) return m[1];
  }
  return null;
}

/** Канонический URL для апстрима — собираем сами, ввод пользователя не пересылаем. */
export function buildWatchUrl(videoId) {
  if (!isVideoId(videoId)) throw new Error('invalid video id');
  return `https://www.youtube.com/watch?v=${videoId}`;
}
