export const BOARD_CACHE_TTL = 300;
export const BOARD_CARDS_TTL = 60;

export const boardTag = (boardId: string): string => `board:${boardId}`;
export const wsBoardsTag = (workspaceId: string): string => `ws:${workspaceId}:boards`;
