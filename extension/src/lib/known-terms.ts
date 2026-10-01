/** Without cloud: empty known set → keep all generated cards. */
export async function loadKnownTermsForImport(): Promise<Set<string>> {
  return new Set()
}
