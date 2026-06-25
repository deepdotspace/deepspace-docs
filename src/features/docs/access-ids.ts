/**
 * Helpers for the JSON-encoded id lists stored on `documents.collaborators`
 * and `documents.editors`. Both columns hold a JSON string array of user ids;
 * these parse it defensively and de-duplicate when writing it back.
 */

/** Parse a JSON-encoded id array, tolerating null/garbage by returning []. */
export function parseIds(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** De-duplicate ids and drop falsy entries, preserving first-seen order. */
export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}
