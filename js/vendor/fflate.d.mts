export function unzipSync(
  data: Uint8Array,
  opts?: { filter?: (file: { name: string }) => boolean }
): Record<string, Uint8Array>

export function zipSync(
  data: Record<string, Uint8Array | undefined | null>,
  opts?: { level?: number }
): Uint8Array

export function strToU8(str: string, latin1?: boolean): Uint8Array
export function strFromU8(dat: Uint8Array, latin1?: boolean): string
