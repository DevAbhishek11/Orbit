# Load tests (k6)

Install k6: https://k6.io/docs/getting-started/installation/

## Run

```bash
# Board read/write burst
BASE_URL=http://localhost:8010 TOKEN=<jwt> WORKSPACE_ID=<id> k6 run load-tests/k6-board.js

# Chat burst
BASE_URL=http://localhost:8010 TOKEN=<jwt> WORKSPACE_ID=<id> k6 run load-tests/k6-chat.js
```

Outputs `load-tests/summary.json` after each run.

Thresholds:
- http_req_failed < 1%
- boards_read p95 < 300ms
- boards_write p95 < 600ms
- chat p95 < 400ms

CI: these tests are NOT run in CI by default (need live API). Run them against staging before release.
