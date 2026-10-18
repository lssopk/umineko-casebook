#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-5699}"
BIND_ADDR="${BIND_ADDR:-0.0.0.0}"
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT<1 || PORT>65535)); then echo "Invalid port $PORT" >&2;exit 1;fi
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  echo '请先安装 Docker Engine 与 Docker Compose v2: https://docs.docker.com/engine/install/' >&2;exit 1
fi
export PORT BIND_ADDR
echo "=== 海猫专属档案馆：管理员登录 + AI 推理室 ==="
echo "绑定 ${BIND_ADDR}:${PORT}; 首次部署将先在后台初始化管理员密码。"
docker compose build
if ! docker compose run --rm --no-deps -T casebook node manage.js has-password >/dev/null 2>&1; then
  if [[ ! -r /dev/tty ]]; then
    echo '首次运行需要 SSH 交互式终端设置管理员密码，防止未配置密码时公网开放。' >&2
    echo '请在 VPS 的终端运行：cd ~/umineko-casebook && bash ./deploy.sh' >&2
    exit 1
  fi
  echo '请设置管理员密码（至少 12 字符）。字符不会回显。'
  read -r -s -p '管理员密码: ' ADMIN_PASS </dev/tty; echo
  if (( ${#ADMIN_PASS} < 12 )); then echo '管理员密码长度不足，服务未启动。' >&2;exit 1;fi
  printf '%s\n' "$ADMIN_PASS" | docker compose run --rm --no-deps -T casebook node manage.js set-password --stdin
  unset ADMIN_PASS
fi
docker compose up -d --no-build --remove-orphans
echo '--- 容器状态 ---'
docker compose ps
for ((i=0;i<20;i++));do
  if command -v curl >/dev/null && curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1;then break;fi
  sleep 2
done
if command -v curl >/dev/null && ! curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/healthz";then
  echo '健康检查失败，查看日志：docker compose logs --tail=100 casebook' >&2;exit 1
fi
if [[ "$BIND_ADDR" == '0.0.0.0' ]];then
  if command -v ufw >/dev/null && ufw status 2>/dev/null|grep -qi '^Status: active';then ufw allow "${PORT}/tcp" || true
  elif command -v firewall-cmd >/dev/null && firewall-cmd --state 2>/dev/null|grep -qx running;then firewall-cmd --permanent --add-port="${PORT}/tcp" && firewall-cmd --reload || true
  fi
fi
echo
echo "部署完成：http://<VPS公网IP>:${PORT}（建议使用 HTTPS 反代）"
echo '管理员改密：docker compose exec -T casebook node manage.js set-password --stdin'
echo '创建 AI 独立密钥：docker compose exec casebook node manage.js create-key --name codex'
echo 'AI 每60秒检查讨论队列：在 .env 配置 AI_API_KEY（服务端），再重启 ./deploy.sh。'
echo '完整卸载：bash ./uninstall.sh --purge'
