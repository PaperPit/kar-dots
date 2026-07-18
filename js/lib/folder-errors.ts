function errorToMessage(err: unknown): string {
  return String(err instanceof Error ? err.message : err || "")
}

export function isMissingFolderIconColumnError(err: unknown) {
  const msg = errorToMessage(err).toLowerCase()
  return msg.includes("icon") && msg.includes("folders")
}

export function isMissingBoxesTableError(err: unknown) {
  const msg = errorToMessage(err).toLowerCase()
  return (
    msg.includes("boxes") &&
    (msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      msg.includes("could not find"))
  )
}

export function isMissingBoxIdColumnError(err: unknown) {
  const msg = errorToMessage(err).toLowerCase()
  return msg.includes("box_id") && msg.includes("folders")
}

export function isMissingBoxIconColumnError(err: unknown) {
  const msg = errorToMessage(err).toLowerCase()
  return msg.includes("icon") && msg.includes("boxes")
}

export function folderSaveErrorMessage(err: unknown) {
  const text = String(err instanceof Error ? err.message : err || "Ошибка сохранения")
  if (isMissingFolderIconColumnError(err)) {
    return "В Supabase нет колонки icon для папок. SQL Editor → выполните: alter table public.folders add column if not exists icon text;"
  }
  if (isMissingBoxIconColumnError(err)) {
    return "В Supabase нет колонки icon для коробок. SQL Editor → выполните: alter table public.boxes add column if not exists icon text;"
  }
  if (isMissingBoxesTableError(err)) {
    return "Коробка сохранена на этом устройстве. Для синхронизации между устройствами выполните SQL из docs/supabase-boxes.sql в Supabase."
  }
  if (isMissingBoxIdColumnError(err)) {
    return "Привязка папок сохранена локально. Добавьте колонку box_id: alter table public.folders add column if not exists box_id uuid;"
  }
  return text
}

export function withoutFolderIcon<T extends object>(obj: T): T {
  const next = Object.assign({}, obj) as Record<string, unknown>
  delete next.icon
  return next as T
}

export function withoutBoxId<T extends object>(obj: T): T {
  const next = Object.assign({}, obj) as Record<string, unknown>
  delete next.box_id
  return next as T
}
