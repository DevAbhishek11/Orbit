/**
 * authorize (BUILD_PROMPT Phase 4, layers 2 + 3 of RBAC):
 *  1. resource scope loader (when provided) — invisible resources answer 404
 *  2. workspace resolution — param > resource > JWT claim
 *  3. FRESH membership role (cached 60 s) — revoked members lose access at once;
 *     foreign tenants answer 404, never 403 (no resource enumeration)
 *  4. permission matrix check
 *  5. private-visibility + own-scope checks
 * The repository layer (level 3) additionally filters every query by workspaceId.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { roleHasPermission, RoleRank, type Permission, type Role, Roles } from '@orbit/shared';
import { forbiddenRole, notFound, unauthenticated } from '../infrastructure/errors/ApiError.js';
import { cacheDel, cacheGet, cacheSet } from '../infrastructure/cache/cacheService.js';
import { findMembership, findWorkspaceById } from '../modules/workspaces/workspaces.repository.js';
import type { AuthContext } from './requestContext.js';
import { invalidateAuthSnapshot } from './authenticate.js';

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (Roles as readonly string[]).includes(value);
}

/** Cached fresh membership lookup — the source of truth for role checks. */
export async function getFreshRole(workspaceId: string, userId: string): Promise<Role | null> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace || workspace.archivedAt) return null;
  const key = `member:${workspaceId}:${userId}`;
  const cached = await cacheGet<{ role: string | null }>(key);
  if (cached) return isRole(cached.value.role) ? cached.value.role : null;
  const membership = await findMembership(workspaceId, userId);
  const role = membership && membership.status === 'active' ? membership.role : null;
  await cacheSet(key, { role }, { ttlSeconds: 60, tags: [`ws:${workspaceId}:members`] });
  return role;
}

/** Call after any membership/role change so permissions apply instantly. */
export async function invalidateMembershipCache(workspaceId: string, userId: string): Promise<void> {
  await cacheDel(`member:${workspaceId}:${userId}`);
  await invalidateAuthSnapshot(userId);
}

export interface ScopeDescriptor {
  workspaceId: string;
  createdBy?: string;
  visibility?: 'workspace' | 'private';
  memberIds?: string[];
  allowedUserIds?: string[];
}

export interface AuthorizeOptions {
  /** Workspace id param name in req.params (default: 'wid'). */
  workspaceParam?: string;
  /** Resource-scope loader (level 2): returning null ⇒ 404 (hidden resource). */
  load?: (req: Request) => Promise<ScopeDescriptor | null>;
  /** When 'own', only the creator (or owner/admin) passes. */
  scope?: 'any' | 'own';
}

/** Middleware factory — authenticate must have run first. */
export function authorize(permission: Permission, options: AuthorizeOptions = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const auth: AuthContext | undefined = req.auth;
    if (!auth) return next(unauthenticated());

    // 1. Load the resource descriptor first — it may define the workspace.
    let descriptor: ScopeDescriptor | null = null;
    if (options.load) {
      descriptor = await options.load(req);
      if (!descriptor) return next(notFound('Resource'));
    }

    // 2. Resolve the tenant: route param > resource > token claim.
    const paramWid =
      options.workspaceParam !== undefined
        ? (req.params[options.workspaceParam] as string | undefined)
        : (req.params.wid as string | undefined);
    const workspaceId = paramWid ?? descriptor?.workspaceId ?? auth.workspaceId;
    if (!workspaceId) {
      return next(forbiddenRole('This action requires a workspace context'));
    }
    if (descriptor && descriptor.workspaceId !== workspaceId) {
      return next(notFound('Resource')); // resource belongs to another tenant
    }

    // 3. Fresh membership — cross-tenant or removed member ⇒ 404.
    const role = await getFreshRole(workspaceId, auth.userId);
    if (!role) return next(notFound('Workspace'));
    auth.workspaceId = workspaceId;
    auth.role = role;

    // 4. Permission matrix.
    if (!roleHasPermission(role, permission)) return next(forbiddenRole());

    // 5. Visibility + own-scope.
    if (descriptor) {
      const isPrivate = descriptor.visibility === 'private';
      const inExplicitMembers =
        (descriptor.memberIds ?? []).includes(auth.userId) ||
        (descriptor.allowedUserIds ?? []).includes(auth.userId);
      const privileged = role === 'owner' || role === 'admin';
      if (isPrivate && !inExplicitMembers && !privileged && descriptor.createdBy !== auth.userId) {
        return next(notFound('Resource')); // private & invisible ⇒ 404
      }
      if (options.scope === 'own' && !privileged && descriptor.createdBy !== auth.userId) {
        return next(forbiddenRole('You can only modify resources you created'));
      }
    }

    next();
  };
}

/** Helper for services: assert actor outranks target (member management). */
export function canManage(actorRole: Role, targetRole: Role): boolean {
  return RoleRank[actorRole] > RoleRank[targetRole];
}
