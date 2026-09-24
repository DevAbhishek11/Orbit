/**
 * Seed demo data: one workspace, five users covering every role, one board
 * with three lists and a handful of cards (labels, assignees, due dates,
 * checklists) so the UI has something to show on first run.
 *
 *   npm run seed
 *
 * Idempotent: if the demo workspace slug already exists the script exits
 * without writing anything. Password for every demo account comes from
 * SEED_DEMO_PASSWORD (default `Orbit@1234567`).
 */
import mongoose from 'mongoose';
import { firstKey, incrementKey, type Role } from '@orbit/shared';
import { env } from '../src/config/env.js';
import { logger } from '../src/infrastructure/logger/index.js';
import { hashPassword } from '../src/modules/auth/passwords.js';
import { createBoard, createList } from '../src/modules/boards/boards.repository.js';
import { createCard } from '../src/modules/cards/cards.repository.js';
import { createUser, findUserByEmail } from '../src/modules/users/users.repository.js';
import {
  createMember,
  createWorkspace,
  findWorkspaceBySlug,
} from '../src/modules/workspaces/workspaces.repository.js';

const SLUG = 'orbit-demo';
const PASSWORD = env.SEED_DEMO_PASSWORD;

const PEOPLE: Array<{ email: string; name: string; handle: string; role: Role }> = [
  { email: 'owner@orbit.dev', name: 'Olivia Owner', handle: 'olivia', role: 'owner' },
  { email: 'admin@orbit.dev', name: 'Adam Admin', handle: 'adam', role: 'admin' },
  { email: 'manager@orbit.dev', name: 'Maya Manager', handle: 'maya', role: 'manager' },
  { email: 'member@orbit.dev', name: 'Miles Member', handle: 'miles', role: 'member' },
  { email: 'viewer@orbit.dev', name: 'Vera Viewer', handle: 'vera', role: 'viewer' },
];

const CARDS: Array<{
  list: number;
  title: string;
  description?: string;
  priority?: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  dueInDays?: number;
  assignee?: number;
  labels?: Array<{ id: string; name: string; color: string }>;
  checklist?: Array<{ title: string; done: boolean }>;
}> = [
  {
    list: 0,
    title: 'Ship the board drag & drop',
    description: 'Fractional order keys mean a move is one document write.',
    priority: 'high',
    assignee: 3,
    labels: [{ id: 'l-frontend', name: 'frontend', color: '#6c8cff' }],
  },
  {
    list: 0,
    title: 'Write the runbook',
    description: 'Boot order, failure modes and how to read the health probes.',
    assignee: 1,
    labels: [{ id: 'l-docs', name: 'docs', color: '#3ecf8e' }],
  },
  {
    list: 1,
    title: 'Transaction for the card move',
    description: 'Card + both list counters + activity + audit in one transaction.',
    priority: 'urgent',
    dueInDays: 2,
    assignee: 2,
    labels: [{ id: 'l-backend', name: 'backend', color: '#a06bff' }],
    checklist: [
      { title: 'Version guard', done: true },
      { title: 'Counter updates', done: true },
      { title: 'Post-commit cache invalidation', done: false },
    ],
  },
  {
    list: 1,
    title: 'Rate-limit tiers',
    description: 'Auth tier fails closed; reads fail open.',
    priority: 'medium',
    assignee: 1,
  },
  {
    list: 2,
    title: 'Response envelope',
    description: 'Every route answers { success, data, meta }.',
    assignee: 0,
  },
  {
    list: 2,
    title: 'Cursor pagination',
    description: 'Seek queries, never skip.',
  },
];

async function main(): Promise<void> {
  logger.info({ dbName: env.MONGO_DB_NAME, slug: SLUG }, 'connecting to seed demo data');
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGO_DB_NAME,
    serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    autoIndex: false,
  });

  if (await findWorkspaceBySlug(SLUG)) {
    logger.warn(`workspace "${SLUG}" already exists — nothing to do`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await hashPassword(PASSWORD);
  const userIds: string[] = [];
  for (const person of PEOPLE) {
    const existing = await findUserByEmail(person.email);
    if (existing) {
      logger.info({ email: person.email }, 'user already exists — reusing');
      userIds.push(String(existing._id));
      continue;
    }
    const user = await createUser({
      email: person.email,
      passwordHash,
      name: person.name,
      handle: person.handle,
      status: 'active',
      emailVerifiedAt: new Date(),
      timezone: 'UTC',
    });
    userIds.push(String(user._id));
    logger.info({ email: person.email, role: person.role }, 'created user');
  }

  const owner = await findUserByEmail(PEOPLE[0]!.email);
  if (!owner) throw new Error('owner user vanished mid-seed');

  const workspace = await createWorkspace({
    name: 'Orbit Demo',
    slug: SLUG,
    createdBy: String(owner._id),
    settings: { timezone: 'UTC', weekStart: 1, defaultRole: 'member' },
    stats: { memberCount: PEOPLE.length, boardCount: 1, pageCount: 0, channelCount: 0 },
  });
  const workspaceId = String(workspace._id);

  for (const [index, person] of PEOPLE.entries()) {
    await createMember({
      workspaceId,
      userId: userIds[index]!,
      role: person.role,
      status: 'active',
    });
  }
  logger.info({ members: PEOPLE.length }, 'workspace members created');

  const board = await createBoard({
    workspaceId,
    name: 'Product launch',
    description: 'Demo board — drag the cards between the three lists.',
    createdBy: String(owner._id),
    background: 'gradient-1',
    stats: { listCount: 3, cardCount: CARDS.length },
  });
  const boardId = String(board._id);

  let listOrder: string | null = null;
  const listIds: string[] = [];
  for (const name of ['To do', 'In progress', 'Done']) {
    listOrder = listOrder === null ? firstKey() : incrementKey(listOrder);
    const list = await createList({ workspaceId, boardId, name, order: listOrder, cardCount: CARDS.filter((card) => card.list === listIds.length).length });
    listIds.push(String(list._id));
  }

  let cardOrder: string | null = null;
  for (const spec of CARDS) {
    cardOrder = cardOrder === null ? firstKey() : incrementKey(cardOrder);
    const listId = listIds[spec.list]!;
    await createCard({
      workspaceId,
      boardId,
      listId,
      title: spec.title,
      description: spec.description,
      order: cardOrder,
      priority: spec.priority ?? 'none',
      assignees: spec.assignee !== undefined ? [userIds[spec.assignee]!] : [],
      labels: spec.labels ?? [],
      dueAt: spec.dueInDays ? new Date(Date.now() + spec.dueInDays * 86_400_000) : null,
      createdBy: String(owner._id),
      watcherIds: [String(owner._id)],
      checklists: spec.checklist
        ? [{ id: 'cl-1', title: 'Steps', items: spec.checklist.map((item, i) => ({ id: `it-${i}`, title: item.title, done: item.done })) }]
        : [],
      checklistProgress: {
        done: spec.checklist?.filter((item) => item.done).length ?? 0,
        total: spec.checklist?.length ?? 0,
      },
    });
  }

  logger.info(
    {
      workspace: SLUG,
      board: board.name,
      lists: listIds.length,
      cards: CARDS.length,

    },
    'seed complete — sign in with any of the demo emails',
  );
  for (const person of PEOPLE) logger.info({ email: person.email, role: person.role }, 'demo account');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'seed crashed');
  process.exit(1);
});
