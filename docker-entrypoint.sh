#!/bin/bash
set -euo pipefail

PROXY_CONFIG="${PROXY_CONFIG:-/app/data/proxy/config.yaml}"
PROXY_PORT="${PROXY_PORT:-7890}"
proxy_pid=""

if [ -f "$PROXY_CONFIG" ]; then
  config_dir="$(dirname "$PROXY_CONFIG")"
  for f in /app/geodata/*; do
    [ -e "$f" ] || continue
    [ -e "$config_dir/$(basename "$f")" ] || cp "$f" "$config_dir/" 2>/dev/null || true
  done
  mihomo -d "$config_dir" -f "$PROXY_CONFIG" &
  proxy_pid=$!
  for _ in $(seq 1 50); do
    kill -0 "$proxy_pid" 2>/dev/null || break
    if curl -s -o /dev/null --max-time 1 "http://127.0.0.1:${PROXY_PORT}"; then
      break
    fi
    sleep 0.2
  done
  if kill -0 "$proxy_pid" 2>/dev/null; then
    export HTTP_PROXY="http://127.0.0.1:${PROXY_PORT}"
    export HTTPS_PROXY="$HTTP_PROXY"
    export NO_PROXY="localhost,127.0.0.1,::1,redis,api.deepseek.com${NO_PROXY:+,$NO_PROXY}"
    export NODE_USE_ENV_PROXY=1
    echo "[entrypoint] proxy active on 127.0.0.1:${PROXY_PORT}; routing follows $PROXY_CONFIG"
  else
    echo "[entrypoint] mihomo failed to start; continuing without proxy" >&2
    proxy_pid=""
  fi
else
  echo "[entrypoint] no proxy config at $PROXY_CONFIG; running without proxy" >&2
fi

node apps/web/server.js &
app_pid=$!

term() {
  kill -TERM "$app_pid" ${proxy_pid:+"$proxy_pid"} 2>/dev/null || true
}
trap term TERM INT

if [ -n "$proxy_pid" ]; then
  status=0
  wait -n "$app_pid" "$proxy_pid" || status=$?
  term
  wait || true
  exit "$status"
fi
wait "$app_pid"