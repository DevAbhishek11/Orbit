import { afterEach, describe, expect, it } from "vitest";
import { getRememberedEmail, isRememberMeEnabled } from "./auth";

describe("remember me persistence", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("is disabled by default", () => {
    expect(isRememberMeEnabled()).toBe(false);
    expect(getRememberedEmail()).toBe("");
  });

  it("returns the stored email only when remember-me is on", () => {
    localStorage.setItem("orbit.lastEmail", "person@orbit.test");
    localStorage.setItem("orbit.rememberMe", "false");
    expect(getRememberedEmail()).toBe("");

    localStorage.setItem("orbit.rememberMe", "true");
    expect(isRememberMeEnabled()).toBe(true);
    expect(getRememberedEmail()).toBe("person@orbit.test");
  });

  it("tolerates a missing email entry", () => {
    localStorage.setItem("orbit.rememberMe", "true");
    expect(getRememberedEmail()).toBe("");
  });
});
