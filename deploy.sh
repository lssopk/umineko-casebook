#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-5699}"
BIND_ADDR="${BIND_ADDR:-127.0.0.1}"
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT<1 || PORT>65535)); then echo 'Invalid PORT'; exit 1; fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo '需要 Docker Engine 与 Docker Compose v2。请先安装官方 Docker。';
  echo 'Debian/Ubuntu 指南: https://docs.docker.com/engine/install/'; exit 1
fi
export PORT BIND_ADDR
echo "Deploying to ${BIND_ADDR}:${PORT} ..."
docker compose up -d --build --remove-orphans
echo '--- status ---'
docker compose ps
echo "Health: http://127.0.0.1:${PORT}/healthz"
echo '公开监听时: BIND_ADDR=0.0.0.0 ./deploy.sh (自行配置防火墙)'
