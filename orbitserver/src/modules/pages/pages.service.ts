import { firstKey, keyBetween } from '@orbit/shared';
import { conflict, notFound, validationFailed } from '../../infrastructure/errors/ApiError.js';
import { runInTransaction } from '../../infrastructure/db/transaction.js';
import { emitSafe } from '../../infrastructure/events/eventBus.js';
import { enqueue } from '../../infrastructure/queues/index.js';
import * as repo from './pages.repository.js';
import type { PageDoc, PageBlock } from './pages.model.js';
import type { CreatePageInput, UpdatePageInput } from './pages.schema.js';

function extractPlainText(blocks: PageBlock[] = []): string {
  return blocks
    .map((b) => b.content)
    .filter(Boolean)
    .join('\n')
    .slice(0, 50_000);
}

export async function createPage(
  workspaceId: string,
  input: CreatePageInput,
  actorId: string,
): Promise<PageDoc> {
  let ancestors: string[] = [];
  let depth = 0;

  if (input.parentId) {
    const parent = await repo.findPageByIdScoped(input.parentId, workspaceId);
    if (!parent) throw notFound('Parent page');
    if (parent.depth >= 8) {
      throw validationFailed([{ path: 'depth', message: 'Maximum page nesting depth is 8' }]);
    }
    ancestors = [...parent.ancestors, parent._id.toString()];
    depth = parent.depth + 1;
  }

  const siblings = await repo.findPagesByWorkspace(workspaceId, input.parentId ?? null);
  const lastSibling = siblings[siblings.length - 1];
  const order = lastSibling ? keyBetween(lastSibling.order, null) : firstKey();

  const initialBlocks: PageBlock[] = [
    {
      id: Math.random().toString(36).slice(2, 10),
      type: 'paragraph',
      content: '',
      order: firstKey(),
    },
  ];

  const page = await repo.createPage({
    workspaceId,
    title: input.title,
    icon: input.icon ?? 'file-text',
    cover: input.cover ?? null,
    parentId: input.parentId ?? null,
    ancestors,
    depth,
    order,
    blocks: initialBlocks,
    plainText: '',
    visibility: input.visibility ?? 'workspace',
    allowedUserIds: [],
    favouriteOf: [],
    version: 1,
    createdBy: actorId,
    lastSnapshotAt: new Date(),
  });

  await repo.createVersionSnapshot({
    pageId: page._id.toString(),
    workspaceId,
    version: 1,
    title: page.title,
    blocks: initialBlocks,
    snapshotReason: 'initial_creation',
    createdBy: actorId,
  });

  try {
    emitSafe(`workspace:${workspaceId}`, 'page:updated', {
      pageId: page._id.toString(),
      title: page.title,
      action: 'created',
    });
    void enqueue('search-index', 'reindex-entity', {
      entityType: 'page',
      entityId: page._id.toString(),
      workspaceId,
    });
  } catch {}

  return page;
}

export async function getPage(pageId: string, workspaceId: string): Promise<PageDoc> {
  const page = await repo.findPageByIdScoped(pageId, workspaceId);
  if (!page) throw notFound('Page');
  return page;
}

export async function getPageTree(workspaceId: string): Promise<PageDoc[]> {
  return repo.findPageTree(workspaceId);
}

export async function updatePage(
  pageId: string,
  workspaceId: string,
  input: UpdatePageInput,
  actorId: string,
): Promise<PageDoc> {
  const current = await repo.findPageByIdScoped(pageId, workspaceId);
  if (!current) throw notFound('Page');

  if (current.version !== input.version) {
    throw conflict('Page was modified by another session', {
      currentVersion: current.version,
      updatedAt: current.updatedAt,
      page: current,
    });
  }

  const newBlocks = input.blocks ?? current.blocks;
  const newPlainText = input.blocks ? extractPlainText(newBlocks) : current.plainText;
  const newVersion = current.version + 1;
  const now = new Date();

  const shouldSnapshot =
    !current.lastSnapshotAt ||
    now.getTime() - new Date(current.lastSnapshotAt).getTime() > 5 * 60_000;

  if (shouldSnapshot) {
    await repo.createVersionSnapshot({
      pageId: current._id.toString(),
      workspaceId,
      version: newVersion,
      title: input.title ?? current.title,
      blocks: newBlocks,
      snapshotReason: 'autosave',
      createdBy: actorId,
    });
  }

  const updated = await repo.updatePageById(pageId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.cover !== undefined ? { cover: input.cover } : {}),
    ...(input.blocks !== undefined ? { blocks: newBlocks, plainText: newPlainText } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
    version: newVersion,
    ...(shouldSnapshot ? { lastSnapshotAt: now } : {}),
  });

  if (!updated) throw notFound('Page');

  try {
    emitSafe(`page:${pageId}`, 'page:updated', {
      pageId,
      version: newVersion,
      title: updated.title,
    });
    emitSafe(`workspace:${workspaceId}`, 'page:updated', {
      pageId,
      version: newVersion,
    });
    void enqueue('search-index', 'reindex-entity', {
      entityType: 'page',
      entityId: pageId,
      workspaceId,
    });
  } catch {}

  return updated;
}

export async function deletePage(
  pageId: string,
  workspaceId: string,
): Promise<{ deletedCount: number }> {
  return runInTransaction(async (tx) => {
    const count = await repo.softDeleteSubtree(pageId, workspaceId, tx.session);
    return { deletedCount: count };
  });
}

export async function restorePage(
  pageId: string,
  workspaceId: string,
): Promise<{ restoredCount: number }> {
  return runInTransaction(async (tx) => {
    const count = await repo.restoreSubtree(pageId, workspaceId, tx.session);
    return { restoredCount: count };
  });
}

export async function toggleFavourite(
  pageId: string,
  workspaceId: string,
  userId: string,
): Promise<{ isFavourite: boolean }> {
  const page = await repo.findPageByIdScoped(pageId, workspaceId);
  if (!page) throw notFound('Page');

  const favourites = page.favouriteOf ?? [];
  const exists = favourites.includes(userId);
  const nextFavourites = exists
    ? favourites.filter((id) => id !== userId)
    : [...favourites, userId];

  await repo.updatePageById(pageId, { favouriteOf: nextFavourites });
  return { isFavourite: !exists };
}

export async function getPageVersions(pageId: string, workspaceId: string) {
  const page = await repo.findPageByIdScoped(pageId, workspaceId);
  if (!page) throw notFound('Page');
  return repo.findVersionsByPage(pageId);
}

export async function restorePageVersion(
  pageId: string,
  versionId: string,
  workspaceId: string,
  actorId: string,
): Promise<PageDoc> {
  const page = await repo.findPageByIdScoped(pageId, workspaceId);
  if (!page) throw notFound('Page');

  const snapshot = await repo.findVersionById(versionId);
  if (!snapshot || snapshot.pageId !== pageId) throw notFound('Version snapshot');

  const newVersion = page.version + 1;
  const newPlainText = extractPlainText(snapshot.blocks);

  const updated = await repo.updatePageById(pageId, {
    title: snapshot.title,
    blocks: snapshot.blocks,
    plainText: newPlainText,
    version: newVersion,
    lastSnapshotAt: new Date(),
  });

  if (!updated) throw notFound('Page');

  await repo.createVersionSnapshot({
    pageId,
    workspaceId,
    version: newVersion,
    title: snapshot.title,
    blocks: snapshot.blocks,
    snapshotReason: `restored_from_v${snapshot.version}`,
    createdBy: actorId,
  });

  return updated;
}
