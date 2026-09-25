import { describe, expect, it } from "vitest";
import {
  Permissions,
  ROLE_PERMISSIONS,
  RoleRank,
  Roles,
  outranks,
  roleHasPermission,
} from "./permissions.js";

describe("permissions matrix", () => {
  it("every permission in the catalogue is held by the owner", () => {
    for (const p of Permissions) {
      expect(roleHasPermission("owner", p), `owner should hold ${p}`).toBe(
        true,
      );
    }
  });

  it("privilege is monotonic: a higher rank never holds fewer permissions", () => {
    const ordered = [...Roles].sort((a, b) => RoleRank[a] - RoleRank[b]);
    for (let i = 1; i < ordered.length; i++) {
      const lower = ordered[i - 1]!;
      const higher = ordered[i]!;
      for (const p of Permissions) {
        if (roleHasPermission(lower, p)) {
          expect(
            roleHasPermission(higher, p),
            `${higher} should inherit ${p} from ${lower}`,
          ).toBe(true);
        }
      }
    }
  });

  it("viewer is strictly read-only inside a workspace", () => {
    const viewerPerms = ROLE_PERMISSIONS.viewer;
    for (const p of viewerPerms) {
      if (p === "workspace:create") continue;
      expect(p, `viewer permission ${p} must be a read`).toMatch(/:read$/);
    }
    expect(roleHasPermission("viewer", "card:create")).toBe(false);
    expect(roleHasPermission("viewer", "message:send")).toBe(false);
  });

  it("member can create content but not administer", () => {
    expect(roleHasPermission("member", "card:create")).toBe(true);
    expect(roleHasPermission("member", "message:send")).toBe(true);
    expect(roleHasPermission("member", "workspace:members:remove")).toBe(false);
    expect(roleHasPermission("member", "admin:audit")).toBe(false);
    expect(roleHasPermission("member", "card:delete")).toBe(false);
  });

  it("manager moderates content but cannot manage members", () => {
    expect(roleHasPermission("manager", "card:delete")).toBe(true);
    expect(roleHasPermission("manager", "message:delete:any")).toBe(true);
    expect(roleHasPermission("manager", "workspace:members:update")).toBe(
      false,
    );
    expect(roleHasPermission("manager", "admin:queue")).toBe(false);
  });

  it("admin manages members but cannot destroy the workspace", () => {
    expect(roleHasPermission("admin", "workspace:members:remove")).toBe(true);
    expect(roleHasPermission("admin", "admin:audit")).toBe(true);
    expect(roleHasPermission("admin", "workspace:delete")).toBe(false);
    expect(roleHasPermission("admin", "workspace:transfer")).toBe(false);
  });

  it("outranks is strict", () => {
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("member", "manager")).toBe(false);
  });

  it("matrix sets contain only catalogue permissions", () => {
    const catalogue = new Set<string>(Permissions);
    for (const role of Roles) {
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(catalogue.has(p), `${role} holds unknown permission ${p}`).toBe(
          true,
        );
      }
    }
  });
});
