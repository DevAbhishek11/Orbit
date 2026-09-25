import type { ClientSession, Types } from 'mongoose';
import { clampLimit, decodeCursor, encodeCursor, buildSeekFilter } from '@orbit/shared';
import { ActivityModel, type IActivity } from './activities.model.js';

export async function createActivity(
  data: Omit<IActivity, 'createdAt'>,
  session?: ClientSession,
): Promise<void> {
  await ActivityModel.create([{ ...data, createdAt: new Date() }], { session });
}

export type ActivityDoc = IActivity & { _id: Types.ObjectId };

export interface ActivityPage {
  activities: ActivityDoc[];
  nextCursor: string | null;
}

export async function listEntityActivity(
  entityType: IActivity['entityType'],
  entityId: string,
  pagination: { limit?: number; cursor?: string } = {},
): Promise<ActivityPage> {
  const limit = clampLimit(pagination.limit);
  const filter: Record<string, unknown> = { entityType, entityId };
  const cursorPayload = pagination.cursor ? decodeCursor(pagination.cursor) : null;
  if (cursorPayload) Object.assign(filter, buildSeekFilter('createdAt', -1, cursorPayload));

  const rows = await ActivityModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean<ActivityDoc[]>()
    .exec();

  const hasMore = rows.length > limit;
  const activities = hasMore ? rows.slice(0, limit) : rows;
  const last = activities[activities.length - 1];
  return {
    activities,
    nextCursor:
      hasMore && last
        ? encodeCursor({ v: last.createdAt.toISOString(), i: String(last._id) })
        : null,
  };
}
