import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  broadcastSession,
  getAccessToken,
  setAccessToken,
  setCrossTabHooks,
} from "./client";

describe("access token store", () => {
  afterEach(() => {
    setAccessToken(null);
    setCrossTabHooks({});
  });

  it("stores and clears the in-memory access token", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("token-a");
    expect(getAccessToken()).toBe("token-a");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });
});

describe("cross-tab session channel", () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    setCrossTabHooks({});
    setAccessToken(null);
  });

  it("adopts a token broadcast by another tab", async () => {
    const received: string[] = [];
    setCrossTabHooks({ onToken: (token) => received.push(token) });

    const other = new BroadcastChannel("orbit.session");
    other.postMessage({ type: "token", accessToken: "from-tab-b", at: 1 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    other.close();

    expect(received).toEqual(["from-tab-b"]);
    expect(getAccessToken()).toBe("from-tab-b");
  });

  it("clears the token when another tab signs out", async () => {
    setAccessToken("still-here");
    const signOut = vi.fn();
    setCrossTabHooks({ onSignOut: signOut });

    const other = new BroadcastChannel("orbit.session");
    other.postMessage({ type: "signed-out", at: 2 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    other.close();

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it("notifies listeners when another tab signs in", async () => {
    const signIn = vi.fn();
    setCrossTabHooks({ onSignIn: signIn });

    const other = new BroadcastChannel("orbit.session");
    other.postMessage({ type: "signed-in", at: 3 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    other.close();

    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("does not throw when broadcasting without listeners", () => {
    expect(() => broadcastSession({ type: "signed-out", at: 4 })).not.toThrow();
  });
});

describe("ApiError", () => {
  it("carries the code, status and request id", () => {
    const error = new ApiError("TOKEN_REUSED", "nope", 401, { a: 1 }, "req-1");
    expect(error.code).toBe("TOKEN_REUSED");
    expect(error.status).toBe(401);
    expect(error.details).toEqual({ a: 1 });
    expect(error.requestId).toBe("req-1");
    expect(error).toBeInstanceOf(Error);
  });
});
