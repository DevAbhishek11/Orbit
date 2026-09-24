#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Orbit dev-dependency bootstrap for sandboxed environments without
#  apt/root access. Builds Redis 7.2 from source into ~/.local/bin and
#  starts the dual-Redis dev topology:
#    redis-cache  → 127.0.0.1:6379 (allkeys-lru, no AOF)
#    redis-queue  → 127.0.0.1:6380 (noeviction, AOF)
#  Idempotent: safe to re-run after a sandbox reset.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

REDIS_VERSION="7.2.7"
BIN_DIR="$HOME/.local/bin"
SRC_DIR="$HOME/.local/src"
DATA_DIR="/tmp/orbit-redis"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$BIN_DIR" "$SRC_DIR" "$DATA_DIR/cache" "$DATA_DIR/queue"

if [ ! -x "$BIN_DIR/redis-server" ]; then
  echo "▸ Building redis $REDIS_VERSION from source (this takes ~3 min)…"
  rm -rf "$SRC_DIR/redis-build"
  git clone --depth 1 --branch "$REDIS_VERSION" https://github.com/redis/redis.git "$SRC_DIR/redis-build"
  make -C "$SRC_DIR/redis-build" MALLOC=libc -j"$(nproc)" redis-server
  cp "$SRC_DIR/redis-build/src/redis-server" "$BIN_DIR/"
  # redis-cli is optional (verification can go through ioredis)
  make -C "$SRC_DIR/redis-build" MALLOC=libc redis-cli || true
  [ -f "$SRC_DIR/redis-build/src/redis-cli" ] && cp "$SRC_DIR/redis-build/src/redis-cli" "$BIN_DIR/" || true
fi

start_instance() {
  local name="$1" conf="$2" dir="$3"
  if pgrep -f "redis-server.*orbit-${name}" > /dev/null 2>&1; then
    echo "▸ redis-${name} already running"
    return
  fi
  echo "▸ Starting redis-${name}"
  nohup "$BIN_DIR/redis-server" "$conf" --dir "$dir" --logfile "" --daemonize yes --pidfile "/tmp/orbit-redis/${name}.pid"
}

start_instance cache "$REPO_ROOT/orbitserver/infra/redis-cache.conf" "$DATA_DIR/cache"
start_instance queue "$REPO_ROOT/orbitserver/infra/redis-queue.conf" "$DATA_DIR/queue"

sleep 1
if [ -x "$BIN_DIR/redis-cli" ]; then
  "$BIN_DIR/redis-cli" -p 6379 -a cache_pw --no-auth-warning CONFIG GET maxmemory-policy | tail -1
  "$BIN_DIR/redis-cli" -p 6380 -a queue_pw --no-auth-warning CONFIG GET maxmemory-policy | tail -1
fi
echo "✔ dual redis ready: cache=6379 (allkeys-lru), queue=6380 (noeviction+AOF)"
