#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"

# compose.yaml 默认绑定 0.0.0.0:5699（公网 IPv4），可通过 BIND_ADDR/PORT 覆盖
PORT="${PORT:-5699}"
BIND_ADDR="${BIND_ADDR:-0.0.0.0}"

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT<1 || PORT>65535)); then
  echo "Invalid PORT: $PORT" >&2
  exit 1
fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo '需要 Docker Engine 与 Docker Compose v2。请先安装官方 Docker。' >&2
  echo 'Debian/Ubuntu 指南: https://docs.docker.com/engine/install/' >&2
  exit 1
fi
export PORT BIND_ADDR

echo "Deploying Umineko Casebook at ${BIND_ADDR}:${PORT} ..."
docker compose up -d --build --remove-orphans
echo '--- Containers ---'
docker compose ps

echo '--- Waiting for health endpoint ---'
if command -v curl >/dev/null 2>&1; then
  ok=0
  for ((i=0; i<20; i++)); do
    if curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then ok=1; break; fi
    sleep 2
  done
  if [[ "$ok" -eq 0 ]]; then
    echo "Health check failed. Please inspect: docker compose logs --tail=100" >&2
    exit 1
  fi
  echo "Health check OK: http://127.0.0.1:${PORT}/healthz"
else
  echo "curl 未安装，使用 docker compose ps 查看容器健康状态。"
fi

if [[ "$BIND_ADDR" == "0.0.0.0" || "$BIND_ADDR" == "::" ]]; then
  # Only open the requested TCP port when a supported host firewall is active.
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi '^Status: active'; then
    ufw allow "${PORT}/tcp" || echo "警告：UFW 放行失败，请手动检查 ${PORT}/tcp" >&2
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state 2>/dev/null | grep -qx running; then
    (firewall-cmd --permanent --add-port="${PORT}/tcp" && firewall-cmd --reload) || echo "警告：firewalld 放行失败，请手动检查 ${PORT}/tcp" >&2
  fi
  echo "公网访问：http://<VPS公网IP>:${PORT}"
  echo "注意：云服务商安全组、上游防火墙也需放行 TCP ${PORT}。"
  echo "安全提醒：本项目没有账号密码保护，请优先使用 HTTPS 反代和访问控制。"
else
  echo "仅绑定 ${BIND_ADDR}:${PORT}；本机代理地址：http://127.0.0.1:${PORT}"
fi
echo "若想只监听本机：BIND_ADDR=127.0.0.1 ./deploy.sh"
