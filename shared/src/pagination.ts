/**
 * Cursor pagination contract (BUILD_PROMPT §4):
 *   ?limit=25&cursor=<opaque>&sort=-updatedAt
 * Cursor = base64url of JSON { v: sortValue, i: _id }. Opaque to clients.
 * `skip` is NEVER used — seek queries stay index-friendly at any depth.
 */
import { PAGINATION } from './constants.js';

export interface CursorPayload {
  /** Value of the primary sort field on the boundary document. */
  v: string | number | null;
  /** Document _id — the tiebreaker that makes the cursor unique. */
  i: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'v' in parsed &&
      'i' in parsed &&
      typeof (parsed as CursorPayload).i === 'string'
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Clamp a requested limit into [1, MAX_LIMIT] with the default applied. */
export function clampLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return PAGINATION.DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), PAGINATION.MAX_LIMIT);
}

/**
 * Build the seek filter for "next page" given sort direction:
 *   desc (-field): next page has field < v, or field == v and _id < i
 *   asc  (+field): next page has field > v, or field == v and _id > i
 * Returns a Mongo filter fragment keyed by the sort field and `_id`.
 */
export function buildSeekFilter(
  sortField: string,
  direction: 1 | -1,
  cursor: CursorPayload,
): Record<string, unknown> {
  const op = direction === -1 ? '$lt' : '$gt';
  if (cursor.v === null) {
    // Null sort values live at the end for desc, start for asc; _id breaks ties.
    return { _id: { [op]: cursor.i } };
  }
  return {
    $or: [
      { [sortField]: { [op]: cursor.v } },
      { [sortField]: cursor.v, _id: { [op]: cursor.i } },
    ],
  };
}
