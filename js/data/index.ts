export { DEFAULT_SETTINGS, uuid } from "./store-common.js"
export { LocalStore } from "./store-local.js"
export { folderSaveErrorMessage } from "../lib/folder-errors.js"
import type { Card } from "./types.js"

/** Нормализует карточку после загрузки (старые бэкапы без description). */
export function normalizeCard(card: Card): Card {
  if (card.description === undefined || card.description === null) card.description = ""
  return card
}
