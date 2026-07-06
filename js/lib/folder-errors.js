export function isMissingFolderIconColumnError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('icon') && msg.includes('folders');
}

export function isMissingBoxesTableError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('boxes') && (
    msg.includes('schema cache')
    || msg.includes('does not exist')
    || msg.includes('could not find')
  );
}

export function isMissingBoxIdColumnError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('box_id') && msg.includes('folders');
}

export function isMissingBoxIconColumnError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('icon') && msg.includes('boxes');
}

export function folderSaveErrorMessage(err) {
  const text = String(err?.message || err || 'Ошибка сохранения');
  if (isMissingFolderIconColumnError(err)) {
    return 'В Supabase нет колонки icon для папок. SQL Editor → выполните: alter table public.folders add column if not exists icon text;';
  }
  if (isMissingBoxIconColumnError(err)) {
    return 'В Supabase нет колонки icon для коробок. SQL Editor → выполните: alter table public.boxes add column if not exists icon text;';
  }
  if (isMissingBoxesTableError(err)) {
    return 'Коробка сохранена на этом устройстве. Для синхронизации между устройствами выполните SQL из docs/supabase-boxes.sql в Supabase.';
  }
  if (isMissingBoxIdColumnError(err)) {
    return 'Привязка папок сохранена локально. Добавьте колонку box_id: alter table public.folders add column if not exists box_id uuid;';
  }
  return text;
}

export function withoutFolderIcon(obj) {
  const next = Object.assign({}, obj);
  delete next.icon;
  return next;
}

export function withoutBoxId(obj) {
  const next = Object.assign({}, obj);
  delete next.box_id;
  return next;
}
