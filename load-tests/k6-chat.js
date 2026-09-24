/**
 * k6 — chat channel + message burst.
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8010';
const TOKEN = __ENV.TOKEN || 'test-token';
const WORKSPACE_ID = __ENV.WORKSPACE_ID || 'test-workspace-id';

function h() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

export default function () {
  group('list channels', () => {
    const res = http.get(`${BASE_URL}/api/v1/channels?workspaceId=${WORKSPACE_ID}`, { headers: h() });
    check(res, { 'channels ok': (r) => r.status === 200 || r.status === 401 });
  });

  group('send message', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/channels/test-channel/messages`,
      JSON.stringify({ body: `k6 msg ${Date.now()}` }),
      { headers: h() },
    );
    check(res, { 'message ok': (r) => [200, 201, 401, 404].includes(r.status) });
  });

  sleep(0.5);
}
