const MANIFEST_URL = 'packs/manifest.json';

export async function fetchPackManifest() {
  const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Не удалось загрузить каталог паков');
  return res.json();
}

export async function fetchVocabPack(packId) {
  const manifest = await fetchPackManifest();
  const meta = manifest.packs?.find(p => p.id === packId);
  if (!meta) throw new Error('Пак не найден');
  const res = await fetch(`packs/${meta.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Не удалось загрузить пак');
  const pack = await res.json();
  if (pack.id !== packId) throw new Error('Неверный файл пака');
  return pack;
}

export function isVocabPackFolder(folder) {
  return !!(folder?.pack_id);
}
