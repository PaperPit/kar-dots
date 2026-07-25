import { store } from '../core/state.js'
import { toast, toastAction } from '../ui/ui.js'
import type { Card, Folder } from '../data/types.js'

const UNDO_MS = 6000

/** Soft undo for a hard-deleted card via toastAction (no schema change). */
export function offerUndoDeleteCard(
  snapshot: Card,
  onRestored?: () => void | Promise<void>,
): void {
  const copy = { ...snapshot }
  toastAction(
    'Карточка удалена',
    'Отменить',
    () => {
      void (async () => {
        try {
          await store.createCard(copy)
          toast('Удаление отменено', 'ok')
          await onRestored?.()
        } catch (e) {
          toast('Не удалось восстановить: ' + (e instanceof Error ? e.message : String(e)), 'error')
        }
      })()
    },
    UNDO_MS,
  )
}

/** Soft undo for a hard-deleted folder + its cards. */
export function offerUndoDeleteFolder(
  folderSnap: Folder,
  cardsSnap: Card[],
  onRestored?: () => void | Promise<void>,
): void {
  const folder = { ...folderSnap }
  const cards = cardsSnap.map((c) => ({ ...c }))
  toastAction(
    'Папка удалена',
    'Отменить',
    () => {
      void (async () => {
        try {
          await store.createFolder(folder)
          for (const c of cards) {
            await store.createCard({ ...c, folder_id: folder.id })
          }
          toast('Удаление отменено', 'ok')
          await onRestored?.()
        } catch (e) {
          toast('Не удалось восстановить: ' + (e instanceof Error ? e.message : String(e)), 'error')
        }
      })()
    },
    UNDO_MS,
  )
}
