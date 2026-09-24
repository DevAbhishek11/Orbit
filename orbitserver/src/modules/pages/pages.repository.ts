/**
 * Pages repository (BUILD_PROMPT Phase 7).
 */
import type { ClientSession } from 'mongoose';
import { PageModel, type PageDoc } from './pages.model.js';
import { PageVersionModel, type PageVersionDoc } from './pageversions.model.js';

export async function findPageById(id: string): Promise<PageDoc | null> {
  return PageModel.findOne({ _id: id, deletedAt: null }).exec();
}

export async function findPageByIdScoped(id: string, workspaceId: string): Promise<PageDoc | null> {
  return PageModel.findOne({ _id: id, workspaceId, deletedAt: null }).exec();
}

export async function findPageByIdIncludingDeleted(id: string): Promise<PageDoc | null> {
  return PageModel.findOne({ _id: id }).exec();
}

export async function findPagesByWorkspace(
  workspaceId: string,
  parentId?: string | null,
): Promise<PageDoc[]> {
  const query: Record<string, unknown> = { workspaceId, deletedAt: null };
  if (parentId !== undefined) query.parentId = parentId;
  return PageModel.find(query).sort({ order: 1 }).exec();
}

export async function findPageTree(workspaceId: string): Promise<PageDoc[]> {
  return PageModel.find({ workspaceId, deletedAt: null })
    .select('_id title icon parentId ancestors depth order visibility favouriteOf createdAt updatedAt')
    .sort({ depth: 1, order: 1 })
    .exec();
}

export async function createPage(
  doc: Partial<PageDoc>,
  session?: ClientSession,
): Promise<PageDoc> {
  const [created] = await PageModel.create([doc], { session });
  return created!;
}

export async function updatePageById(
  id: string,
  update: Partial<PageDoc> & Record<string, unknown>,
  session?: ClientSession,
): Promise<PageDoc | null> {
  return PageModel.findOneAndUpdate({ _id: id, deletedAt: null }, { $set: update }, { new: true, session }).exec();
}

export async function softDeleteSubtree(
  pageId: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<number> {
  const now = new Date();
  // Delete root page + any descendants that have pageId in their ancestors
  const res = await PageModel.updateMany(
    {
      workspaceId,
      deletedAt: null,
      $or: [{ _id: pageId }, { ancestors: pageId }],
    },
    { $set: { deletedAt: now, deletedFrom: pageId } },
    { session },
  ).exec();
  return res.modifiedCount;
}

export async function restoreSubtree(
  pageId: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<number> {
  const res = await PageModel.updateMany(
    {
      workspaceId,
      deletedFrom: pageId,
    },
    { $set: { deletedAt: null, deletedFrom: null } },
    { session },
  ).exec();
  return res.modifiedCount;
}

export async function createVersionSnapshot(
  doc: {
    pageId: string;
    workspaceId: string;
    version: number;
    title: string;
    blocks: unknown[];
    snapshotReason: string;
    createdBy: string;
  },
  session?: ClientSession,
): Promise<PageVersionDoc> {
  const [created] = await PageVersionModel.create([doc], { session });
  return created!;
}

export async function findVersionsByPage(pageId: string, limit = 20): Promise<PageVersionDoc[]> {
  return PageVersionModel.find({ pageId }).sort({ version: -1 }).limit(limit).exec();
}

export async function findVersionById(versionId: string): Promise<PageVersionDoc | null> {
  return PageVersionModel.findOne({ _id: versionId }).exec();
}
