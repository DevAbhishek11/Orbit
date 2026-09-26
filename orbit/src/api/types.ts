export type Role = "owner" | "admin" | "manager" | "member" | "viewer";
export type Visibility = "workspace" | "private";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";

export interface Preferences {
  theme: "light" | "dark" | "system";
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
  stats: {
    memberCount: number;
    boardCount: number;
    pageCount: number;
    channelCount: number;
  };
  joinedAt: string;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: "free" | "pro";
  seatLimit: number;
  settings: {
    timezone: string;
    weekStart: 0 | 1;
    defaultRole: "member" | "viewer";
  };
  stats: Workspace["stats"];
  archivedAt: string | null;
  createdAt: string;
}

export interface Member {
  userId: string;
  role: Role;
  status: "active" | "suspended";
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
  role: Exclude<Role, "owner">;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "accepted" | "declined" | "expired";
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

export interface PageBlock {
  id: string;
  type:
    | "paragraph"
    | "h1"
    | "h2"
    | "h3"
    | "bullet"
    | "numbered"
    | "todo"
    | "quote"
    | "code"
    | "divider"
    | "callout";
  content: string;
  order: string;
  checked?: boolean;
  language?: string;
}

export interface Page {
  id: string;
  _id?: string;
  workspaceId: string;
  title: string;
  icon?: string | null;
  cover?: string | null;
  parentId: string | null;
  ancestors: string[];
  depth: number;
  order: string;
  blocks: PageBlock[];
  plainText: string;
  visibility: "workspace" | "private" | "link";
  allowedUserIds: string[];
  favouriteOf: string[];
  version: number;
  lastSnapshotAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageVersion {
  id: string;
  _id: string;
  pageId: string;
  version: number;
  title: string;
  blocks: PageBlock[];
  snapshotReason: string;
  createdBy: string;
  createdAt: string;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Channel {
  id: string;
  _id?: string;
  workspaceId: string;
  name: string;
  slug: string;
  type: "public" | "private" | "dm";
  topic?: string;
  memberIds: string[];
  lastMessage?: {
    _id: string;
    authorId: string;
    preview: string;
    at: string;
  } | null;
  messageCount: number;
  unread?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  _id?: string;
  workspaceId: string;
  channelId: string;
  authorId: string;
  body: string;
  mentions: string[];
  fileIds: string[];
  parentId?: string | null;
  threadRootId?: string | null;
  replyCount: number;
  lastReplyAt?: string | null;
  reactions: Reaction[];
  editedAt?: string | null;
  deletedAt?: string | null;
  clientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  _id: string;
  workspaceId: string;
  userId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  entityType?: "card" | "page" | "channel" | "workspace" | null;
  entityId?: string | null;
  groupKey?: string | null;
  groupCount: number;
  readAt?: string | null;
  createdAt: string;
}

export interface SearchResults {
  cards: Card[];
  pages: Page[];
  channels: Channel[];
  messages: Message[];
}

export interface SearchResponse {
  query: string;
  totalResults: number;
  results: SearchResults;
}

export interface WorkspaceKpis {
  totalCards: number;
  completedCards: number;
  activeCards: number;
  overdueCards: number;
  completionRate: number;
  pageCount: number;
  channelCount: number;
  messageCount: number;
  boardCount: number;
  memberCount: number;
}

export interface BoardBurndown {
  boardId: string;
  total: number;
  completed: number;
  remaining: number;
  cards: Array<{
    id: string;
    title: string;
    listId: string;
    completed: boolean;
    dueAt: string | null;
    priority: Priority;
  }>;
}
