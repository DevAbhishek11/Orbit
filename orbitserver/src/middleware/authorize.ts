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

export async function invalidateMembershipCache(
  workspaceId: string,
  userId: string,
): Promise<void> {
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
  workspaceParam?: string;

  load?: (req: Request) => Promise<ScopeDescriptor | null>;

  scope?: 'any' | 'own';
}

export function authorize(permission: Permission, options: AuthorizeOptions = {}): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const auth: AuthContext | undefined = req.auth;
    if (!auth) return next(unauthenticated());

    let descriptor: ScopeDescriptor | null = null;
    if (options.load) {
      descriptor = await options.load(req);
      if (!descriptor) return next(notFound('Resource'));
    }

    const paramWid =
      options.workspaceParam !== undefined
        ? (req.params[options.workspaceParam] as string | undefined)
        : (req.params.wid as string | undefined);
    const workspaceId = paramWid ?? descriptor?.workspaceId ?? auth.workspaceId;
    if (!workspaceId) {
      return next(forbiddenRole('This action requires a workspace context'));
    }
    if (descriptor && descriptor.workspaceId !== workspaceId) {
      return next(notFound('Resource'));
    }

    const role = await getFreshRole(workspaceId, auth.userId);
    if (!role) return next(notFound('Workspace'));
    auth.workspaceId = workspaceId;
    auth.role = role;

    if (!roleHasPermission(role, permission)) return next(forbiddenRole());

    if (descriptor) {
      const isPrivate = descriptor.visibility === 'private';
      const inExplicitMembers =
        (descriptor.memberIds ?? []).includes(auth.userId) ||
        (descriptor.allowedUserIds ?? []).includes(auth.userId);
      const privileged = role === 'owner' || role === 'admin';
      if (isPrivate && !inExplicitMembers && !privileged && descriptor.createdBy !== auth.userId) {
        return next(notFound('Resource'));
      }
      if (options.scope === 'own' && !privileged && descriptor.createdBy !== auth.userId) {
        return next(forbiddenRole('You can only modify resources you created'));
      }
    }

    next();
  };
}

export function canManage(actorRole: Role, targetRole: Role): boolean {
  return RoleRank[actorRole] > RoleRank[targetRole];
}
