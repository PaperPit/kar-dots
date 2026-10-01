import { buildCardDescription, type YtCandidate } from "../../../js/lib/youtube-import.js"

export interface SelectedCandidate {
  cand: YtCandidate
  back: string
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function buildCardRow(data: {
  folder_id: string
  front: string
  back: string
  description: string
}) {
  const t = Date.now()
  return {
    id: uuid(),
    created_at: t,
    updated_at: t,
    front: data.front,
    back: data.back,
    description: data.description,
    front_img: null,
    back_img: null,
    folder_id: data.folder_id,
    sm2_ef: 2.5,
    sm2_reps: 0,
    sm2_ivl: 0,
    sm2_due: null,
    box: 0,
    box_due: null
  }
}

/** Собрать JSON v3-совместимый фрагмент для импорта в PWA (без cloud write). */
export function buildImportPayload(
  folderName: string,
  selected: SelectedCandidate[],
  videoId: string | null
): { ok: number; json: string } {
  const folderId = uuid()
  const now = Date.now()
  const cards = []
  for (const { cand, back } of selected) {
    const text = String(back || "").trim()
    if (!text) continue
    cards.push(
      buildCardRow({
        folder_id: folderId,
        front: cand.front || "",
        back: text,
        description: buildCardDescription(cand, videoId)
      })
    )
  }
  const payload = {
    version: 3,
    exported_at: now,
    folders: [{ id: folderId, name: folderName || "YouTube", created_at: now }],
    boxes: [],
    cards,
    notes: [],
    settings: {}
  }
  return { ok: cards.length, json: JSON.stringify(payload, null, 2) }
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
