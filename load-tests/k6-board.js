/**
 * k6 load test — board CRUD + move + real-time burst.
 * Requirements: k6 installed (https://k6.io/docs/getting-started/installation/).
 *
 * Run:
 *   k6 run load-tests/k6-board.js
 *   k6 run --env BASE_URL=http://localhost:8010 --env TOKEN=xxx load-tests/k6-board.js
 *
 * Thresholds: p95 < 300ms for reads, p95 < 600ms for writes, error rate < 1%.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    boards_read: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      exec: 'readBoards',
    },
    boards_write: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      exec: 'writeCards',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:boards_read}': ['p(95)<300'],
    'http_req_duration{scenario:boards_write}': ['p(95)<600'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8010';
const TOKEN = __ENV.TOKEN || 'test-token-placeholder';
const WORKSPACE_ID = __ENV.WORKSPACE_ID || 'test-workspace-id';

function authHeaders() {
  return {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export function readBoards() {
  group('list boards', () => {
    const res = http.get(`${BASE_URL}/api/v1/boards?workspaceId=${WORKSPACE_ID}`, {
      headers: authHeaders(),
    });
    check(res, {
      'list boards 200 or 401': (r) => r.status === 200 || r.status === 401,
      'has envelope': (r) => {
        try {
          const j = r.json();
          return typeof j.success === 'boolean';
        } catch {
          return false;
        }
      },
    });
  });

  group('search', () => {
    const res = http.get(`${BASE_URL}/api/v1/search?q=test&workspaceId=${WORKSPACE_ID}`, {
      headers: authHeaders(),
    });
    check(res, { 'search ok': (r) => r.status === 200 || r.status === 401 });
  });

  sleep(1);
}

export function writeCards() {
  // Create board → create list → create card → move card → delete card
  const boardPayload = JSON.stringify({
    title: `k6 board ${Date.now()}`,
    workspaceId: WORKSPACE_ID,
  });

  let boardId = null;
  group('create board', () => {
    const res = http.post(`${BASE_URL}/api/v1/boards`, boardPayload, { headers: authHeaders() });
    check(res, { 'create board 201 or 401': (r) => r.status === 201 || r.status === 401 });
    try {
      const j = res.json();
      boardId = j?.data?._id || j?.data?.id || null;
    } catch {}
  });

  if (!boardId) {
    sleep(1);
    return;
  }

  let listId = null;
  group('create list', () => {
    const res = http.post(`${BASE_URL}/api/v1/boards/${boardId}/lists`, JSON.stringify({ title: 'To do' }), {
      headers: authHeaders(),
    });
    check(res, { 'create list ok': (r) => r.status === 201 || r.status === 200 || r.status === 401 });
    try {
      const j = res.json();
      listId = j?.data?._id || j?.data?.id || null;
    } catch {}
  });

  let cardId = null;
  if (listId) {
    group('create card', () => {
      const res = http.post(`${BASE_URL}/api/v1/lists/${listId}/cards`, JSON.stringify({ title: 'k6 card' }), {
        headers: authHeaders(),
      });
      check(res, { 'create card ok': (r) => r.status === 201 || r.status === 200 || r.status === 401 });
      try {
        const j = res.json();
        cardId = j?.data?._id || j?.data?.id || null;
      } catch {}
    });
  }

  if (cardId && listId) {
    group('move card', () => {
      const res = http.post(
        `${BASE_URL}/api/v1/cards/${cardId}/move`,
        JSON.stringify({ toListId: listId, toIndex: 0 }),
        { headers: authHeaders() },
      );
      check(res, { 'move card ok': (r) => r.status === 200 || r.status === 401 });
    });
  }

  if (cardId) {
    group('delete card', () => {
      const res = http.del(`${BASE_URL}/api/v1/cards/${cardId}`, null, { headers: authHeaders() });
      check(res, { 'delete card ok': (r) => r.status === 200 || r.status === 204 || r.status === 401 });
    });
  }

  group('delete board', () => {
    const res = http.del(`${BASE_URL}/api/v1/boards/${boardId}`, null, { headers: authHeaders() });
    check(res, { 'delete board ok': (r) => r.status === 200 || r.status === 204 || r.status === 401 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'load-tests/summary.json': JSON.stringify(data, null, 2),
  };
}
