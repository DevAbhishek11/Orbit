/**
 * Pages routes (BUILD_PROMPT Phase 7).
 */
import { Router, type Request } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize, type ScopeDescriptor } from '../../middleware/authorize.js';
import { idempotency } from '../../middleware/idempotency.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { findPageById, findPageByIdScoped } from './pages.repository.js';
import * as controller from './pages.controller.js';
import {
  createPageSchema,
  pageParamsSchema,
  pageVersionParamsSchema,
  updatePageSchema,
  widParamsSchema,
} from './pages.schema.js';

export const pagesRouter = Router();

const writeLimit = rateLimit({ tier: 'write' });

async function loadPage(req: Request): Promise<ScopeDescriptor | null> {
  const auth = req.auth!;
  const page =
    (await findPageByIdScoped(String(req.params.id), auth.workspaceId ?? '')) ??
    (await findPageById(String(req.params.id)));
  if (!page) return null;
  return {
    workspaceId: page.workspaceId,
    createdBy: page.createdBy,
    visibility: page.visibility === 'link' ? 'workspace' : page.visibility,
    allowedUserIds: page.allowedUserIds,
  };
}

// Workspace collection routes
pagesRouter.post(
  '/workspaces/:wid/pages',
  authenticate(),
  writeLimit,
  validate({ params: widParamsSchema, body: createPageSchema }),
  idempotency(),
  authorize('page:create', { workspaceParam: 'wid' }),
  controller.createPage,
);

pagesRouter.get(
  '/workspaces/:wid/pages/tree',
  authenticate(),
  validate({ params: widParamsSchema }),
  authorize('page:read', { workspaceParam: 'wid' }),
  controller.getPageTree,
);

// Individual page routes
pagesRouter.get(
  '/pages/:id',
  authenticate(),
  validate({ params: pageParamsSchema }),
  authorize('page:read', { load: loadPage }),
  controller.getPage,
);

pagesRouter.patch(
  '/pages/:id',
  authenticate(),
  writeLimit,
  validate({ params: pageParamsSchema, body: updatePageSchema }),
  authorize('page:update', { load: loadPage }),
  controller.updatePage,
);

pagesRouter.delete(
  '/pages/:id',
  authenticate(),
  writeLimit,
  validate({ params: pageParamsSchema }),
  authorize('page:delete', { load: loadPage }),
  controller.deletePage,
);

pagesRouter.post(
  '/pages/:id/restore',
  authenticate(),
  writeLimit,
  validate({ params: pageParamsSchema }),
  authorize('page:restore', { load: loadPage }),
  controller.restorePage,
);

pagesRouter.post(
  '/pages/:id/favourite',
  authenticate(),
  validate({ params: pageParamsSchema }),
  authorize('page:read', { load: loadPage }),
  controller.toggleFavourite,
);

pagesRouter.get(
  '/pages/:id/versions',
  authenticate(),
  validate({ params: pageParamsSchema }),
  authorize('page:read', { load: loadPage }),
  controller.getPageVersions,
);

pagesRouter.post(
  '/pages/:id/versions/:versionId/restore',
  authenticate(),
  writeLimit,
  validate({ params: pageVersionParamsSchema }),
  authorize('page:versions:restore', { load: loadPage }),
  controller.restorePageVersion,
);
