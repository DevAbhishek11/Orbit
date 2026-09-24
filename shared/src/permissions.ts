/**
 * Orbit RBAC — roles, permission catalogue and the role→permission matrix.
 * Enforced in four layers (route middleware, service, repository guard, socket room).
 * Permissions follow `resource:action` naming (BUILD_PROMPT §4).
 */

export const Roles = ['owner', 'admin', 'manager', 'member', 'viewer'] as const;
export type Role = (typeof Roles)[number];

export const Permissions = [
  // workspace
  'workspace:create',
  'workspace:update',
  'workspace:delete',
  'workspace:transfer',
  'workspace:invite',
  'workspace:members:read',
  'workspace:members:update',
  'workspace:members:remove',
  // boards
  'board:read',
  'board:create',
  'board:update',
  'board:delete',
  'board:archive',
  // lists
  'list:create',
  'list:update',
  'list:delete',
  'list:reorder',
  // cards
  'card:read',
  'card:create',
  'card:update',
  'card:move',
  'card:delete',
  'card:assign',
  'card:comment',
  // pages
  'page:read',
  'page:create',
  'page:update',
  'page:delete',
  'page:restore',
  'page:versions:restore',
  // chat
  'channel:read',
  'channel:create',
  'channel:update',
  'channel:delete',
  'message:send',
  'message:edit:any',
  'message:delete:any',
  // files
  'file:upload',
  'file:delete',
  // admin
  'admin:audit',
  'admin:queue',
  'admin:analytics',
] as const;

export type Permission = (typeof Permissions)[number];

/** Role hierarchy rank — higher number = more privilege. */
export const RoleRank: Readonly<Record<Role, number>> = {
  owner: 50,
  admin: 40,
  manager: 30,
  member: 20,
  viewer: 10,
};

const WRITE_MEMBER: readonly Permission[] = [
  'board:read',
  'list:create',
  'list:update',
  'list:reorder',
  'card:read',
  'card:create',
  'card:update',
  'card:move',
  'card:assign',
  'card:comment',
  'page:read',
  'page:create',
  'page:update',
  'page:restore',
  'channel:read',
  'message:send',
  'file:upload',
  'workspace:members:read',
];

const READ_ONLY: readonly Permission[] = [
  // Any authenticated user may create their OWN workspace (becoming its owner),
  // regardless of their role inside someone else's workspace.
  'workspace:create',
  'board:read',
  'card:read',
  'page:read',
  'channel:read',
  'workspace:members:read',
];

const MANAGER_EXTRA: readonly Permission[] = [
  'board:create',
  'board:update',
  'board:archive',
  'list:delete',
  'card:delete',
  'page:delete',
  'channel:create',
  'channel:update',
  'message:edit:any',
  'message:delete:any',
  'workspace:invite',
  'admin:analytics',
];

const ADMIN_EXTRA: readonly Permission[] = [
  'workspace:update',
  'workspace:members:update',
  'workspace:members:remove',
  'board:delete',
  'channel:delete',
  'page:versions:restore',
  'file:delete',
  'admin:audit',
  'admin:queue',
];

const OWNER_EXTRA: readonly Permission[] = ['workspace:delete', 'workspace:transfer'];

function build(...sets: readonly (readonly Permission[])[]): ReadonlySet<Permission> {
  return new Set<Permission>(sets.flat());
}

/** The matrix: what each workspace role is allowed to do. */
export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  owner: build(READ_ONLY, WRITE_MEMBER, MANAGER_EXTRA, ADMIN_EXTRA, OWNER_EXTRA),
  admin: build(READ_ONLY, WRITE_MEMBER, MANAGER_EXTRA, ADMIN_EXTRA),
  manager: build(READ_ONLY, WRITE_MEMBER, MANAGER_EXTRA),
  member: build(READ_ONLY, WRITE_MEMBER),
  viewer: build(READ_ONLY),
};

/** Pure check used by middleware, services and tests. */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** True when `actor` outranks or equals `target` (for member management rules). */
export function outranks(actor: Role, target: Role): boolean {
  return RoleRank[actor] > RoleRank[target];
}
