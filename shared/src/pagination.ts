import { PAGINATION } from "./constants.js";

export interface CursorPayload {
  v: string | number | null;

  i: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "i" in parsed &&
      typeof (parsed as CursorPayload).i === "string"
    ) {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export function clampLimit(raw: number | undefined): number {
  if (raw === undefined || Number.isNaN(raw)) return PAGINATION.DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(raw), 1), PAGINATION.MAX_LIMIT);
}

export function buildSeekFilter(
  sortField: string,
  direction: 1 | -1,
  cursor: CursorPayload,
): Record<string, unknown> {
  const op = direction === -1 ? "$lt" : "$gt";
  if (cursor.v === null) {
    return { _id: { [op]: cursor.i } };
  }
  return {
    $or: [
      { [sortField]: { [op]: cursor.v } },
      { [sortField]: cursor.v, _id: { [op]: cursor.i } },
    ],
  };
}
