/** Cache TTLs and tag names for the boards pillar. */
export const BOARD_CACHE_TTL = 300; // 5 min (spec: board view)
export const BOARD_CARDS_TTL = 60; // first page of cards

export const boardTag = (boardId: string): string => `board:${boardId}`;
export const wsBoardsTag = (workspaceId: string): string => `ws:${workspaceId}:boards`;
