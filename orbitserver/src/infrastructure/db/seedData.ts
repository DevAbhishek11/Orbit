import { firstKey, incrementKey, type Role } from '@orbit/shared';
import { hashPassword } from '../../modules/auth/passwords.js';
import { createBoard, createList } from '../../modules/boards/boards.repository.js';
import { createCard } from '../../modules/cards/cards.repository.js';
import { createPage } from '../../modules/pages/pages.repository.js';
import { createChannel, createMessage } from '../../modules/chat/chat.repository.js';
import { createUser, findUserByEmail } from '../../modules/users/users.repository.js';
import {
  createMember,
  createWorkspace,
  findWorkspaceBySlug,
} from '../../modules/workspaces/workspaces.repository.js';
import { childLogger } from '../logger/index.js';

const log = childLogger({ module: 'seed' });

const PRIMARY_EMAIL = 'dev.abhishek.ap11@gmail.com';
const PRIMARY_PASS = 'Admin@1120@ABHI';
const WORKSPACE_SLUG = 'orbit-workspace';

const DEMO_USERS: Array<{ email: string; name: string; handle: string; role: Role; pass: string }> =
  [
    {
      email: PRIMARY_EMAIL,
      name: 'Abhishek',
      handle: 'abhishek',
      role: 'owner',
      pass: PRIMARY_PASS,
    },
    {
      email: 'owner@orbit.dev',
      name: 'Olivia Owner',
      handle: 'olivia',
      role: 'owner',
      pass: 'Orbit@1234567',
    },
    {
      email: 'admin@orbit.dev',
      name: 'Adam Admin',
      handle: 'adam',
      role: 'admin',
      pass: 'Orbit@1234567',
    },
    {
      email: 'manager@orbit.dev',
      name: 'Maya Manager',
      handle: 'maya',
      role: 'manager',
      pass: 'Orbit@1234567',
    },
    {
      email: 'member@orbit.dev',
      name: 'Miles Member',
      handle: 'miles',
      role: 'member',
      pass: 'Orbit@1234567',
    },
  ];

export async function ensureInitialData(): Promise<void> {
  const existingPrimary = await findUserByEmail(PRIMARY_EMAIL);
  if (existingPrimary && (await findWorkspaceBySlug(WORKSPACE_SLUG))) {
    return;
  }

  const userIds: string[] = [];
  for (const person of DEMO_USERS) {
    const existing = await findUserByEmail(person.email);
    if (existing) {
      userIds.push(String(existing._id));
      continue;
    }
    const passwordHash = await hashPassword(person.pass);
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
  }

  let workspace = await findWorkspaceBySlug(WORKSPACE_SLUG);
  let workspaceId = workspace ? String(workspace._id) : '';

  if (!workspace) {
    const ownerId = userIds[0]!;
    workspace = await createWorkspace({
      name: 'Orbit Enterprise',
      slug: WORKSPACE_SLUG,
      createdBy: ownerId,
      settings: { timezone: 'UTC', weekStart: 1, defaultRole: 'member' },
      stats: { memberCount: DEMO_USERS.length, boardCount: 2, pageCount: 2, channelCount: 3 },
    });
    workspaceId = String(workspace._id);

    for (const [index, person] of DEMO_USERS.entries()) {
      await createMember({
        workspaceId,
        userId: userIds[index]!,
        role: person.role,
        status: 'active',
      });
    }

    const board = await createBoard({
      workspaceId,
      name: 'Product Roadmap & Sprint',
      description: 'Main product planning board for tracking sprints and releases.',
      createdBy: ownerId,
      background: 'gradient-1',
      stats: { listCount: 3, cardCount: 5 },
    });
    const boardId = String(board._id);

    let listOrder: string | null = null;
    const listNames = ['Backlog', 'In Progress', 'Completed'];
    const listIds: string[] = [];
    for (const name of listNames) {
      listOrder = listOrder === null ? firstKey() : incrementKey(listOrder);
      const list = await createList({
        workspaceId,
        boardId,
        name,
        order: listOrder,
        cardCount: name === 'Backlog' ? 2 : name === 'In Progress' ? 2 : 1,
      });
      listIds.push(String(list._id));
    }

    const cardsSpec = [
      {
        list: 0,
        title: 'Implement Dark & Light Theme Toggle',
        description:
          'Ensure all UI surfaces and typography adapt seamlessly across light and dark palettes.',
        priority: 'high' as const,
        labels: [{ id: 'l-design', name: 'design', color: '#6c8cff' }],
        checklist: [
          { id: 'c1', title: 'Token variables audit', done: true },
          { id: 'c2', title: 'Persistence in localStorage and user profile', done: true },
        ],
      },
      {
        list: 0,
        title: 'Interactive Password Validation Regex',
        description:
          'Verify password complexity with real-time feedback and eye toggle for visibility.',
        priority: 'urgent' as const,
        labels: [{ id: 'l-sec', name: 'security', color: '#ff6b6b' }],
      },
      {
        list: 1,
        title: 'Lucide Iconography Transition',
        description:
          'Eliminate emojis across all routes and replace them with standard Lucide React icons.',
        priority: 'high' as const,
        labels: [{ id: 'l-ui', name: 'ui', color: '#3ecf8e' }],
      },
      {
        list: 1,
        title: 'Collapsible Modern Sidebar',
        description:
          'Build an expandable and collapsible navigation bar with smooth animations and tooltips.',
        priority: 'medium' as const,
        labels: [{ id: 'l-fe', name: 'frontend', color: '#a06bff' }],
      },
      {
        list: 2,
        title: 'MongoDB Multi-cluster Connection Support',
        description:
          'Reliable connection to MongoDB Atlas with graceful fallback for isolated sandboxes.',
        priority: 'low' as const,
        labels: [{ id: 'l-be', name: 'backend', color: '#f5a524' }],
      },
    ];

    let cardOrder: string | null = null;
    for (const item of cardsSpec) {
      cardOrder = cardOrder === null ? firstKey() : incrementKey(cardOrder);
      await createCard({
        workspaceId,
        boardId,
        listId: listIds[item.list]!,
        title: item.title,
        description: item.description,
        order: cardOrder,
        priority: item.priority,
        assignees: [ownerId],
        labels: item.labels,
        createdBy: ownerId,
        watcherIds: [ownerId],
        checklists: item.checklist
          ? [{ id: 'cl-1', title: 'Deliverables', items: item.checklist }]
          : [],
        checklistProgress: {
          done: item.checklist ? item.checklist.filter((i) => i.done).length : 0,
          total: item.checklist ? item.checklist.length : 0,
        },
      });
    }

    const doc1 = await createPage({
      workspaceId,
      title: 'Welcome to Orbit Workspace',
      icon: 'sparkles',
      order: firstKey(),
      createdBy: ownerId,
    });
    void doc1;

    const doc2 = await createPage({
      workspaceId,
      title: 'Engineering & Product Handbook',
      icon: 'file-text',
      order: incrementKey(firstKey()),
      createdBy: ownerId,
    });
    void doc2;

    const ch1 = await createChannel({
      workspaceId,
      name: 'general',
      slug: 'general',
      topic: 'Company-wide updates and collaboration',
      type: 'public',
      createdBy: ownerId,
    });
    await createMessage({
      workspaceId,
      channelId: String(ch1._id),
      authorId: ownerId,
      body: 'Welcome to Orbit! Everything is configured and ready for your team.',
    });

    await createChannel({
      workspaceId,
      name: 'engineering',
      slug: 'engineering',
      topic: 'Technical discussions, code reviews, and architecture',
      type: 'public',
      createdBy: ownerId,
    });

    log.info('Initial workspace, boards, and demo users seeded successfully');
  }
}
