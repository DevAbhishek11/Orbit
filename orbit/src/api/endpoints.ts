/**
 * Typed wrappers for every Orbit API endpoint.
 * One function per route, named after the resource, so components never build
 * URLs or payloads by hand.
 */
import { idempotencyKey, request, requestWithMeta } from './client';
import type {
  Activity,
  AuthResult,
  Board,
  BoardView,
  Card,
  Comment,
  Invite,
  Member,
  Priority,
  Role,
  Session,
  User,
  Visibility,
  Workspace,
  WorkspaceDetail,
} from './types';

// ── Health (NOT under /api/v1 — orchestrator probes are unrouted by design) ──

export interface HealthReport {
  status: 'ok' | 'degraded' | 'unavailable';
  uptimeSeconds: number;
  startedAt: string;
  version: string;
  dependencies: { mongo: 'up' | 'down' | 'disabled'; redisCache: string; redisQueue: string };
  runtime?: { topology: string; transactionsSupported: boolean; mongoServerVersion: string; dbName: string; node: string; memoryRssMb: number };
}

export const healthApi = {
  /** 503 is a normal "database down" answer, not a transport failure. */
  ready: async (): Promise<HealthReport> => {
    const response = await fetch('/health/ready', { headers: { accept: 'application/json' } });
    const payload = (await response.json()) as HealthReport;
    if (!response.ok && response.status !== 503) throw new Error(`Health probe failed (${response.status})`);
    return payload;
  },
  live: async (): Promise<{ status: 'ok'; uptimeSeconds: number }> => {
    const response = await fetch('/health/live', { headers: { accept: 'application/json' } });
    return (await response.json()) as { status: 'ok'; uptimeSeconds: number };
  },
};

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: { email: string; password: string; name: string; handle?: string; timezone?: string }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body, idempotencyKey: idempotencyKey('reg') }),

  login: (body: { email: string; password: string; remember?: boolean; workspaceId?: string }) =>
    request<AuthResult>('/auth/login', { method: 'POST', body }),

  refresh: () => request<AuthResult>('/auth/refresh', { method: 'POST', noRetry: true }),

  logout: (allDevices = false) =>
    request<void>('/auth/logout', { method: 'POST', body: { allDevices } }),

  forgotPassword: (email: string) =>
    request<{ sent: boolean }>('/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, password: string) =>
    request<{ reset: boolean }>('/auth/reset-password', { method: 'POST', body: { token, password } }),

  verifyEmail: (token: string) =>
    request<{ email: string }>('/auth/verify-email', { method: 'POST', body: { token } }),

  switchWorkspace: (workspaceId: string) =>
    request<{ accessToken: string; accessExpiresIn: number; workspaceId: string; role: Role }>(
      '/auth/switch-workspace',
      { method: 'POST', body: { workspaceId } },
    ),

  sessions: () => request<{ sessions: Session[] }>('/auth/sessions'),

  revokeSession: (familyId: string) =>
    request<void>(`/auth/sessions/${familyId}`, { method: 'DELETE' }),

  me: () => request<{ userId: string; workspaceId: string | null; role: Role | null }>('/auth/me'),
};

// ── Users ────────────────────────────────────────────────────────────────────

export interface UpdateProfileBody {
  name?: string;
  timezone?: string;
  avatarUrl?: string | null;
  preferences?: {
    theme?: 'light' | 'dark' | 'system';
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
  };
}

export const usersApi = {
  me: () => request<User>('/users/me'),
  updateMe: (body: UpdateProfileBody) => request<User>('/users/me', { method: 'PATCH', body }),
};

// ── Workspaces ───────────────────────────────────────────────────────────────

export interface CreatedWorkspace {
  id: string;
  name: string;
  slug: string;
  role: Role;
  boardId: string;
  createdAt: string;
}

export const workspacesApi = {
  list: () => request<{ workspaces: Workspace[] }>('/workspaces'),

  create: (body: { name: string; slug: string; timezone?: string }) =>
    request<CreatedWorkspace>('/workspaces', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey('ws'),
    }),

  get: (wid: string) => request<WorkspaceDetail>(`/workspaces/${wid}`),

  update: (
    wid: string,
    body: {
      name?: string;
      slug?: string;
      logoUrl?: string | null;
      settings?: { timezone?: string; weekStart?: 0 | 1; defaultRole?: 'member' | 'viewer' };
    },
  ) => request<WorkspaceDetail>(`/workspaces/${wid}`, { method: 'PATCH', body }),

  remove: (wid: string, confirm: string) =>
    request<void>(`/workspaces/${wid}`, { method: 'DELETE', body: { confirm } }),

  transferOwnership: (wid: string, toUserId: string, confirm: string) =>
    request<{ transferred: boolean }>(`/workspaces/${wid}/transfer-ownership`, {
      method: 'POST',
      body: { toUserId, confirm },
    }),

  leave: (wid: string) => request<void>(`/workspaces/${wid}/leave`, { method: 'POST' }),

  members: (wid: string, limit = 200) =>
    request<{ members: Member[] }>(`/workspaces/${wid}/members`, { query: { limit } }),

  updateMember: (wid: string, userId: string, body: { role?: Role; status?: 'active' | 'suspended' }) =>
    request<{ userId: string; role: Role; status: string }>(`/workspaces/${wid}/members/${userId}`, {
      method: 'PATCH',
      body,
    }),

  removeMember: (wid: string, userId: string) =>
    request<void>(`/workspaces/${wid}/members/${userId}`, { method: 'DELETE' }),

  invites: (wid: string) => request<{ invites: Invite[] }>(`/workspaces/${wid}/invites`),

  invite: (wid: string, body: { email: string; role: Exclude<Role, 'owner'> }) =>
    request<{
      invited: true;
      email: string;
      role: string;
      expiresAt: string;
      /** Present only outside production — SMTP is not wired yet. */
      acceptToken?: string;
    }>(`/workspaces/${wid}/invites`, {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey('inv'),
    }),
};

export const invitesApi = {
  accept: (token: string) =>
    request<{ workspaceId: string; role: Role }>(`/invites/${token}/accept`, { method: 'POST' }),
  decline: (token: string) => request<void>(`/invites/${token}/decline`, { method: 'POST' }),
};

// ── Boards & lists ───────────────────────────────────────────────────────────

export interface ListPayload {
  id: string;
  boardId: string;
  name: string;
  order: string;
  color: string | null;
  wipLimit: number | null;
  cardCount: number;
  archivedAt: string | null;
}

export const boardsApi = {
  list: (wid: string, includeArchived = false) =>
    request<{ boards: Board[] }>(`/workspaces/${wid}/boards`, { query: { includeArchived } }),

  create: (
    wid: string,
    body: { name: string; description?: string; visibility?: Visibility; background?: string },
  ) =>
    request<Board>(`/workspaces/${wid}/boards`, {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey('board'),
    }),

  view: (boardId: string) => request<BoardView>(`/boards/${boardId}`),

  update: (
    boardId: string,
    body: {
      name?: string;
      description?: string | null;
      visibility?: Visibility;
      memberIds?: string[];
      background?: string | null;
      archivedAt?: boolean;
    },
  ) => request<Board>(`/boards/${boardId}`, { method: 'PATCH', body }),

  remove: (boardId: string) => request<void>(`/boards/${boardId}`, { method: 'DELETE' }),

  createList: (boardId: string, body: { name: string; color?: string; wipLimit?: number | null }) =>
    request<ListPayload>(`/boards/${boardId}/lists`, {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey('list'),
    }),

  reorderLists: (boardId: string, listIds: string[]) =>
    request<{ listIds: string[] }>('/lists/reorder', { method: 'PATCH', body: { boardId, listIds } }),

  updateList: (
    listId: string,
    body: { name?: string; color?: string | null; wipLimit?: number | null; archivedAt?: boolean },
  ) => request<ListPayload>(`/lists/${listId}`, { method: 'PATCH', body }),

  removeList: (listId: string, force = false) =>
    request<void>(`/lists/${listId}`, { method: 'DELETE', query: { force } }),
};

// ── Cards ────────────────────────────────────────────────────────────────────

export interface CardFilters {
  listId?: string;
  assignee?: string;
  label?: string;
  due?: 'overdue' | 'today' | 'week';
  q?: string;
  completed?: boolean;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export const cardsApi = {
  listForBoard: (boardId: string, filters: CardFilters = {}) =>
    requestWithMeta<{ cards: Card[] }>(`/boards/${boardId}/cards`, { query: { ...filters } }),

  create: (
    listId: string,
    body: {
      title: string;
      description?: string;
      labels?: { id: string; name: string; color: string }[];
      assignees?: string[];
      dueAt?: string | null;
      priority?: Priority;
      beforeCardId?: string | null;
    },
  ) =>
    request<Card>(`/lists/${listId}/cards`, {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey('card'),
    }),

  get: (cardId: string) => request<Card>(`/cards/${cardId}`),

  update: (
    cardId: string,
    version: number,
    body: {
      title?: string;
      description?: string | null;
      labels?: { id: string; name: string; color: string }[];
      checklists?: { id: string; title: string; items: { id: string; title: string; done: boolean }[] }[];
      assignees?: string[];
      dueAt?: string | null;
      startAt?: string | null;
      priority?: Priority;
      coverColor?: string | null;
      completed?: boolean;
      archivedAt?: boolean;
    },
  ) => request<Card>(`/cards/${cardId}`, { method: 'PATCH', body: { version, ...body } }),

  move: (
    cardId: string,
    version: number,
    body: { targetListId: string; beforeCardId?: string | null; afterCardId?: string | null },
  ) =>
    request<Card>(`/cards/${cardId}/move`, {
      method: 'PATCH',
      body: { version, ...body },
      idempotencyKey: idempotencyKey('move'),
    }),

  remove: (cardId: string) => request<void>(`/cards/${cardId}`, { method: 'DELETE' }),

  restore: (cardId: string) => request<Card>(`/cards/${cardId}/restore`, { method: 'POST' }),

  activity: (cardId: string, limit = 25, cursor?: string) =>
    request<{ activities: Activity[]; nextCursor: string | null }>(`/cards/${cardId}/activity`, {
      query: { limit, cursor },
    }),

  comments: (cardId: string) => request<{ comments: Comment[] }>(`/cards/${cardId}/comments`),

  addComment: (cardId: string, body: string) =>
    request<Comment>(`/cards/${cardId}/comments`, {
      method: 'POST',
      body: { body },
      idempotencyKey: idempotencyKey('cmt'),
    }),
};
