/**
 * Pages controller — HTTP plumbing only.
 */
import type { Request, Response } from 'express';
import { created, ok } from '../../infrastructure/http/response.js';
import { requireAuth } from '../../middleware/authenticate.js';
import * as service from './pages.service.js';
import type { CreatePageInput, UpdatePageInput } from './pages.schema.js';

export async function createPage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = String(req.params.wid);
  const result = await service.createPage(wid, req.body as CreatePageInput, auth.userId);
  created(res, { page: result });
}

export async function getPage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const page = await service.getPage(String(req.params.id), wid);
  ok(res, { page });
}

export async function getPageTree(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = String(req.params.wid || auth.workspaceId);
  const pages = await service.getPageTree(wid);
  ok(res, { pages });
}

export async function updatePage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const page = await service.updatePage(
    String(req.params.id),
    wid,
    req.body as UpdatePageInput,
    auth.userId,
  );
  ok(res, { page });
}

export async function deletePage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const result = await service.deletePage(String(req.params.id), wid);
  ok(res, result);
}

export async function restorePage(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const result = await service.restorePage(String(req.params.id), wid);
  ok(res, result);
}

export async function toggleFavourite(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const result = await service.toggleFavourite(String(req.params.id), wid, auth.userId);
  ok(res, result);
}

export async function getPageVersions(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const versions = await service.getPageVersions(String(req.params.id), wid);
  ok(res, { versions });
}

export async function restorePageVersion(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const wid = auth.workspaceId!;
  const page = await service.restorePageVersion(
    String(req.params.id),
    String(req.params.versionId),
    wid,
    auth.userId,
  );
  ok(res, { page });
}
