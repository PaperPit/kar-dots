import type { Folder, Box } from "../data/types.js"

/** Иконки папок — PNG из icons/folders/ */

export const FOLDER_ICONS = [
  { id: "graduation-cap", label: "Учёба" },
  { id: "bulb", label: "Идеи" },
  { id: "globe", label: "Мир" },
  { id: "bookmark", label: "Закладка" },
  { id: "search", label: "Поиск" },
  { id: "edit", label: "Запись" },
  { id: "rocket", label: "Старт" },
  { id: "leaf", label: "Природа" },
  { id: "stethoscope", label: "Медицина" },
  { id: "restaurant", label: "Кухня" },
  { id: "dollar", label: "Финансы" },
  { id: "align-justify", label: "Список" }
]

/** Нижний ряд в выборе значка (коробки и тематика). */
export const ICON_PICKER_BOTTOM = [
  { id: "box-alt", label: "Коробка" },
  { id: "box-open", label: "Открытая коробка" },
  { id: "books", label: "Книги" },
  { id: "pencil", label: "Карандаш" }
]

export const ALL_PICKER_ICONS = [...FOLDER_ICONS, ...ICON_PICKER_BOTTOM]

const VALID = new Set(ALL_PICKER_ICONS.map((i) => i.id))

export function folderIconSrc(id: string | null | undefined): string {
  const key = normalizeFolderIcon(id)
  if (!key) return ""
  return "icons/folders/" + key + ".png"
}

export function folderHasCustomIcon(icon: string | null | undefined): boolean {
  return !!icon && VALID.has(icon)
}

/** null = первая буква названия; иначе id иконки. */
export function normalizeFolderIcon(icon: string | null | undefined): string | null {
  if (!icon) return null
  return VALID.has(icon) ? icon : null
}

export function normalizeFolderRecord(folder: Folder | null | undefined): Folder | null | undefined {
  if (!folder) return folder
  folder.icon = normalizeFolderIcon(folder.icon)
  if (folder.box_id === undefined) folder.box_id = null
  return folder
}

export function normalizeBoxRecord(box: Box | null | undefined): Box | null | undefined {
  if (!box) return box
  box.icon = normalizeFolderIcon(box.icon)
  return box
}
