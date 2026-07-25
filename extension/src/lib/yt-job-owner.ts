/** Владелец YouTube-джоба для расширения: Supabase user id или chrome.storage UUID. */

import { getAuth } from "./storage.js"

const STORAGE_KEY = "kar_yt_job_user"
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(raw: unknown): boolean {
  return UUID_RE.test(String(raw || "").trim())
}

async function anonymousOwnerId(): Promise<string> {
  const got = await chrome.storage.local.get(STORAGE_KEY)
  let id = got[STORAGE_KEY] as string | undefined
  if (!id || !isUuid(id)) {
    id = crypto.randomUUID()
    await chrome.storage.local.set({ [STORAGE_KEY]: id })
  }
  return id
}

export async function getExtYtJobUserId(): Promise<string> {
  const auth = await getAuth()
  const uid = auth?.session?.user?.id
  if (uid && isUuid(uid)) return uid
  return anonymousOwnerId()
}
