/**
 * Files repository.
 */
import type { ClientSession } from 'mongoose';
import { FileModel, type FileDoc } from './files.model.js';

export async function findFileById(id: string): Promise<FileDoc | null> {
  return FileModel.findOne({ _id: id }).exec();
}

export async function findFileByIdScoped(id: string, workspaceId: string): Promise<FileDoc | null> {
  return FileModel.findOne({ _id: id, workspaceId }).exec();
}

export async function findFilesByEntity(
  workspaceId: string,
  entityType: string,
  entityId: string,
): Promise<FileDoc[]> {
  return FileModel.find({ workspaceId, entityType, entityId, status: { $ne: 'deleted' } })
    .sort({ createdAt: -1 })
    .exec();
}

export async function createFile(doc: Partial<FileDoc>, session?: ClientSession): Promise<FileDoc> {
  const [created] = await FileModel.create([doc], { session });
  return created!;
}

export async function updateFileById(
  id: string,
  update: Partial<FileDoc>,
  session?: ClientSession,
): Promise<FileDoc | null> {
  return FileModel.findOneAndUpdate({ _id: id }, { $set: update }, { new: true, session }).exec();
}

export async function deleteFileById(id: string): Promise<void> {
  await FileModel.updateOne({ _id: id }, { $set: { status: 'deleted' } }).exec();
}
