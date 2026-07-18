import type { Folder, Card } from "./types.js"

interface VocabPackCard {
  front?: string
  back?: string
  description?: string
}

interface VocabPack {
  id?: string
  title?: string
  color?: string
  version?: number
  cards?: VocabPackCard[]
}

export interface VocabImportStore {
  folders: Folder[]
  createFolder(folder: Partial<Folder>): Promise<Folder>
  createCard(card: Partial<Card> & { folder_id: string; front: string; back: string }): Promise<unknown>
  deleteFolder(folderId: string): Promise<unknown>
}

export interface ProgressInfo {
  phase: string
  done: number
  total: number
}

export function findFolderByPackId(folders: Folder[], packId: string | null | undefined): Folder | null {
  return folders.find((f) => f.pack_id === packId) || null
}

export async function importVocabPack(store: VocabImportStore, pack: VocabPack | null | undefined, onProgress?: (info: ProgressInfo) => void): Promise<Folder> {
  if (!pack?.id || !Array.isArray(pack.cards)) throw new Error("Неверный формат пака")
  if (findFolderByPackId(store.folders, pack.id)) throw new Error("Этот пак уже установлен")
  const cards = (pack.cards || []).filter((c) => c.front?.trim())
  const folder = await store.createFolder({
    name: pack.title,
    color: pack.color || "#7C8DB5",
    icon: "graduation-cap",
    pack_id: pack.id,
    pack_version: pack.version ?? 1
  })
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!
    await store.createCard({
      folder_id: folder.id,
      front: card.front || "",
      back: card.back || "",
      description: card.description || ""
    })
    if (onProgress) onProgress({ phase: "import", done: i + 1, total: cards.length })
  }
  return folder
}

export async function deleteVocabPack(store: VocabImportStore, packId: string | null | undefined): Promise<void> {
  const folder = findFolderByPackId(store.folders, packId)
  if (!folder) throw new Error("Пак не установлен")
  await store.deleteFolder(folder.id)
}
