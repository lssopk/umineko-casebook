#!/usr/bin/env bash
# 仅删除当前项目的容器、镜像、Compose 数据卷和项目目录，不会卸载共享 Docker Engine。
set -Eeuo pipefail
BASE="$(cd "$(dirname "$0")" && pwd -P)"
PROJECT='海猫专属档案馆'
MAGIC='DELETE-UMINEKO'
case "${1:-}" in
  --purge) ;;
  *) echo "用法：bash ./uninstall.sh --purge [--yes]";echo '将永久删除该项目全部服务端数据、密钥、留言、章节编辑和容器/镜像。';exit 2;;
esac
[[ -f "$BASE/compose.yaml" && -f "$BASE/server.js" && -f "$BASE/room.js" ]] || { echo '项目路径不正确，拒绝清理';exit 1; }
[[ "$BASE" != / && "$BASE" != /root && "$BASE" != /home && "$BASE" != /mnt/data ]] || { echo '危险路径，拒绝清理';exit 1; }
printf '\n即将彻底卸载：%s\n目录：%s\n' "$PROJECT" "$BASE"
echo '永久删除：项目专用 Docker 容器、镜像、数据卷（含账号密码、AI Key、章节修订与留言）及项目代码。'
echo '不会删除共享 Docker、其他项目数据、GitHub 仓库或其他位置的备份。'
if [[ "${2:-}" != '--yes' ]]; then
  read -r -p "确认卸载请输入 ${MAGIC}: " ANSWER </dev/tty
  [[ "$ANSWER" == "$MAGIC" ]] || { echo '已取消';exit 1; }
fi
cd "$BASE"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose down --volumes --rmi all --remove-orphans
else
  echo '警告：Docker 不可用，无法自动删除容器和数据卷；不会删除项目目录以免残留。' >&2;exit 1
fi
cd /
rm -rf -- "$BASE"
echo '彻底卸载完成。防火墙规则、云安全组、反向代理配置请自行核查并清理。'
