/**
 * Response types for the Orbit API.
 * These mirror what `orbitserver` actually returns (see the matching
 * `*.service.ts` serializers) — the API always wraps payloads in
 * `{ success, data, meta }`, which `client.ts` unwraps before we get here.
 */

export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
export type Visibility = 'workspace' | 'private';
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  pushNotifications: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  handle: string;
  timezone: string;
  avatarUrl: string | null;
  status: string;
  emailVerified: boolean;
  preferences: Preferences;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  accessExpiresIn: number;
  workspaceId: string | null;
  role: Role | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: Role;
  stats: { memberCount: number; boardCount: number; pageCount: number; channelCount: number };
  joinedAt: string;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: 'free' | 'pro';
  seatLimit: number;
  settings: { timezone: string; weekStart: 0 | 1; defaultRole: 'member' | 'viewer' };
  stats: Workspace['stats'];
  archivedAt: string | null;
  createdAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  status: 'active' | 'suspended';
  joinedAt: string;
  invitedBy: string | null;
  name: string;
  email: string | null;
  handle: string | null;
  avatarUrl: string | null;
}

export interface Invite {
  id: string;
  email: string;
  role: Exclude<Role, 'owner'>;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  state: 'pending' | 'accepted' | 'declined' | 'expired';
}

export interface Board {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  visibility: Visibility;
  memberIds: string[];
  background: string;
  stats: { listCount: number; cardCount: number };
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface AssigneeProfile {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
}

export interface Card {
  id: string;
  workspaceId: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string;
  order: string;
  labels: Label[];
  checklists: Checklist[];
  assignees: string[];
  dueAt: string | null;
  startAt: string | null;
  completedAt: string | null;
  priority: Priority;
  coverColor?: string;
  attachments: unknown[];
  commentCount: number;
  attachmentCount: number;
  checklistProgress: { done: number; total: number };
  watcherIds: string[];
  sourceMessageId?: string | null;
  pageId?: string | null;
  version: number;
  createdBy: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigneeProfiles?: AssigneeProfile[];
}

export interface ListView {
  id: string;
  name: string;
  order: string;
  color: string | null;
  wipLimit: number | null;
  cardCount: number;
  cards: Card[];
}

export interface BoardView {
  board: Board;
  lists: ListView[];
}

export interface Comment {
  id: string;
  body: string;
  authorId: string;
  mentions: string[];
  createdAt: string;
}

export interface Activity {
  _id?: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface Session {
  id: string;
  device: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string;
  current: boolean;
}
