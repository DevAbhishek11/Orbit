import type { ClientSession, FilterQuery } from 'mongoose';
import { UserModel, type IUser, type UserDoc } from './users.model.js';

export async function findUserByEmail(
  email: string,
  options: { withPassword?: boolean; withSecrets?: boolean; session?: ClientSession } = {},
): Promise<UserDoc | null> {
  const projection = options.withSecrets
    ? '+passwordHash +verificationTokenHash +verificationTokenExpiresAt +resetTokenHash +resetTokenExpiresAt'
    : options.withPassword
      ? '+passwordHash'
      : '';
  const query = UserModel.findOne({ email: email.toLowerCase() }).select(projection);
  if (options.session) query.session(options.session);
  return (await query.lean<UserDoc>().exec()) ?? null;
}

export async function findUserById(
  id: string,
  options: { withPassword?: boolean; session?: ClientSession } = {},
): Promise<UserDoc | null> {
  const query = UserModel.findOne({ _id: id }).select(options.withPassword ? '+passwordHash' : '');
  if (options.session) query.session(options.session);
  return (await query.lean<UserDoc>().exec()) ?? null;
}

export async function findUserByHandle(handle: string): Promise<UserDoc | null> {
  return (await UserModel.findOne({ handle: handle.toLowerCase() }).lean<UserDoc>().exec()) ?? null;
}

export async function findUsersByHandles(handles: string[]): Promise<UserDoc[]> {
  if (handles.length === 0) return [];
  return (
    (await UserModel.find({ handle: { $in: handles.map((h) => h.toLowerCase()) } })
      .limit(50)
      .lean<UserDoc[]>()
      .exec()) ?? []
  );
}

export async function findUsersByIds(ids: string[]): Promise<UserDoc[]> {
  if (ids.length === 0) return [];
  return (
    (await UserModel.find({ _id: { $in: ids } })
      .lean<UserDoc[]>()
      .exec()) ?? []
  );
}

export async function findUsers(filter: FilterQuery<IUser>, limit: number): Promise<UserDoc[]> {
  return (await UserModel.find(filter).limit(limit).lean<UserDoc[]>().exec()) ?? [];
}

export async function findUserByTokenHash(
  field: 'verificationTokenHash' | 'resetTokenHash',
  expiresField: 'verificationTokenExpiresAt' | 'resetTokenExpiresAt',
  tokenHash: string,
): Promise<UserDoc | null> {
  const user = await UserModel.findOne({
    [field]: tokenHash,
    [expiresField]: { $gt: new Date() },
  })
    .select(`+${field} +${expiresField}`)
    .lean<UserDoc>()
    .exec();
  return user ?? null;
}

export async function createUser(
  data: Pick<IUser, 'email' | 'passwordHash' | 'name' | 'handle'> & Partial<IUser>,
  session?: ClientSession,
): Promise<UserDoc> {
  const [user] = await UserModel.create([{ ...data, email: data.email.toLowerCase() }], {
    session,
  });
  return user!.toObject();
}

export async function updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
  ).exec();
}

export async function updateUserProfile(
  userId: string,
  update: Record<string, unknown>,
): Promise<UserDoc | null> {
  const doc = await UserModel.findOneAndUpdate({ _id: userId }, { $set: update }, { new: true })
    .lean<UserDoc>()
    .exec();
  return doc ?? null;
}

export async function bumpTokenVersion(userId: string, session?: ClientSession): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }, { session }).exec();
}

export async function recordFailedLogin(
  userId: string,
  lockAfter: number,
  lockMs: number,
): Promise<void> {
  const updated = await UserModel.findOneAndUpdate(
    { _id: userId },
    { $inc: { failedLoginCount: 1 } },
    { new: true },
  )
    .lean<{ failedLoginCount?: number }>()
    .exec();
  const count = updated?.failedLoginCount ?? 1;
  if (count >= lockAfter) {
    await UserModel.updateOne(
      { _id: userId },
      { $set: { lockedUntil: new Date(Date.now() + lockMs) } },
    ).exec();
  }
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), status: 'active' } },
  ).exec();
}

export async function setVerificationToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { verificationTokenHash: tokenHash, verificationTokenExpiresAt: expiresAt } },
  ).exec();
}

export async function setResetToken(
  userId: string,
  tokenHash: string | null,
  expiresAt: Date | null,
): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    { $set: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt } },
  ).exec();
}

export async function markEmailVerified(userId: string): Promise<void> {
  await UserModel.updateOne(
    { _id: userId },
    {
      $set: {
        emailVerifiedAt: new Date(),
        status: 'active',
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    },
  ).exec();
}

export async function getAuthSnapshot(
  userId: string,
): Promise<{ tokenVersion: number; status: string } | null> {
  const user = await UserModel.findOne({ _id: userId })
    .select('tokenVersion status')
    .lean<{ tokenVersion: number; status: IUser['status'] }>()
    .exec();
  return user ? { tokenVersion: user.tokenVersion, status: user.status } : null;
}
