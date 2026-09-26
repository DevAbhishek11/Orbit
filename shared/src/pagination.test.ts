import { describe, expect, it } from "vitest";
import { PAGINATION } from "./constants.js";
import {
  buildSeekFilter,
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "./pagination.js";

describe("pagination", () => {
  it("round-trips a cursor through base64url", () => {
    const payload = {
      v: "2026-01-01T00:00:00.000Z",
      i: "665f1a2b3c4d5e6f70809012",
    };
    const cursor = encodeCursor(payload);
    expect(cursor).not.toContain("=");
    expect(cursor).not.toContain("+");
    expect(decodeCursor(cursor)).toEqual(payload);
  });

  it("round-trips numeric and null sort values", () => {
    expect(decodeCursor(encodeCursor({ v: 42, i: "x" }))).toEqual({
      v: 42,
      i: "x",
    });
    expect(decodeCursor(encodeCursor({ v: null, i: "x" }))).toEqual({
      v: null,
      i: "x",
    });
  });

  it("returns null for garbage cursors (never throws)", () => {
    expect(decodeCursor("not-a-cursor!!")).toBeNull();
    expect(
      decodeCursor(Buffer.from('{"no":"id"}').toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from("[1,2,3]").toString("base64url")),
    ).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("clamps limits into the contract range", () => {
    expect(clampLimit(undefined)).toBe(PAGINATION.DEFAULT_LIMIT);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
    expect(clampLimit(500)).toBe(PAGINATION.MAX_LIMIT);
    expect(clampLimit(10.9)).toBe(10);
    expect(clampLimit(25)).toBe(25);
  });

  it("builds a desc seek filter with tiebreaker", () => {
    const filter = buildSeekFilter("createdAt", -1, { v: "T2", i: "id2" }) as {
      $or: Record<string, unknown>[];
    };
    expect(filter.$or).toEqual([
      { createdAt: { $lt: "T2" } },
      { createdAt: "T2", _id: { $lt: "id2" } },
    ]);
  });

  it("builds an asc seek filter with tiebreaker", () => {
    const filter = buildSeekFilter("order", 1, { v: "V", i: "id1" }) as {
      $or: Record<string, unknown>[];
    };
    expect(filter.$or).toEqual([
      { order: { $gt: "V" } },
      { order: "V", _id: { $gt: "id1" } },
    ]);
  });

  it("falls back to _id-only seek for null sort values", () => {
    expect(buildSeekFilter("dueAt", -1, { v: null, i: "id9" })).toEqual({
      _id: { $lt: "id9" },
    });
  });
});
