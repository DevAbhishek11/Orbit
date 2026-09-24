/**
 * Orbit global constants — limits, tiers, TTLs (BUILD_PROMPT §4).
 * Changing a number here changes it everywhere (API + web + tests).
 */

/** Pagination contract: cursor-based, `skip` is forbidden. */
export const PAGINATION = {
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
} as const;

/** Auth TTLs and limits. */
export const AUTH = {
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_DAYS: 7,
  REFRESH_TOKEN_TTL_REMEMBER_DAYS: 30,
  REFRESH_TOKEN_BYTES: 64,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_MAX_LENGTH: 128,
  LOGIN_MAX_ATTEMPTS: 10,
  LOGIN_LOCKOUT_MINUTES: 30,
  VERIFICATION_TOKEN_TTL_HOURS: 24,
  RESET_TOKEN_TTL_MINUTES: 30,
  SESSION_CACHE_TTL_SECONDS: 15 * 60,
} as const;

/** Rate-limit tiers (requests per window). Auth tier fails CLOSED, reads fail OPEN. */
export const RATE_LIMIT_TIERS = {
  global: { limit: 300, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 15 * 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  search: { limit: 30, windowMs: 60_000 },
  upload: { limit: 20, windowMs: 60_000 },
  socketMsg: { limit: 20, windowMs: 10_000 },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

/** Workspace / tenant limits. */
export const WORKSPACE = {
  FREE_SEAT_LIMIT: 10,
  PRO_SEAT_LIMIT: 100,
  INVITE_TTL_HOURS: 72,
  FREE_STORAGE_QUOTA_BYTES: 1_073_741_824,
} as const;

/** Content limits — bounded arrays protect document size (16 MB cap). */
export const CONTENT = {
  CARD_TITLE_MAX: 200,
  CARD_DESCRIPTION_MAX: 20_000,
  LABELS_PER_BOARD: 20,
  LABELS_PER_CARD: 6,
  CHECKLISTS_PER_CARD: 10,
  CHECKLIST_ITEMS: 50,
  ATTACHMENTS_PER_CARD: 20,
  PAGE_TITLE_MAX: 240,
  BLOCKS_PER_PAGE: 2_000,
  BLOCK_TEXT_MAX: 8_000,
  PAGE_MAX_DEPTH: 8,
  MESSAGE_BODY_MAX: 8_000,
  REACTIONS_PER_MESSAGE: 50,
  COMMENT_MAX: 4_000,
  ORDER_KEY_MAX_LENGTH: 60,
} as const;

/** Cache TTLs (seconds) and tags. */
export const CACHE = {
  TTL_DEFAULT: 300,
  TTL_BOARD: 300,
  TTL_BOARD_CARDS: 60,
  TTL_CHANNEL: 30,
  TTL_SIDEBAR: 30,
  TTL_WORKSPACES: 60,
  TTL_PAGE_TREE: 60,
  TTL_SUGGESTIONS: 600,
  SWR_SECONDS: 1_800,
  IDEMPOTENCY_TTL_SECONDS: 24 * 3_600,
  DENYLIST_PREFIX: 'denylist:jti:',
} as const;

/** Soft delete / retention. */
export const RETENTION = {
  TRASH_DAYS: 30,
  AUDIT_TTL_DAYS: 365,
  NOTIFICATION_TTL_DAYS: 180,
} as const;

/** Socket.io contract. */
export const SOCKET = {
  PATH: '/socket.io',
  MAX_HTTP_BUFFER: 65_536,
  PING_INTERVAL: 25_000,
  PING_TIMEOUT: 20_000,
  ROOM_LIMIT: 50,
  PRESENCE_TTL_SECONDS: 60,
  TYPING_TTL_SECONDS: 4,
} as const;

/** Cookie names (single source of truth for API + web). */
export const COOKIES = {
  ACCESS: 'orbit_at',
  REFRESH: 'orbit_rt',
  CSRF: 'orbit_csrf',
} as const;
