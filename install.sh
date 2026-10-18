#!/usr/bin/env bash
set -Eeuo pipefail

# 一键安装 / 更新（公共仓库，不需要 GitHub SSH Key）
REPO_URL="https://github.com/lssopk/umineko-casebook.git"
DEST="${DEST:-$HOME/umineko-casebook}"

echo "== 海猫鸣泣之时 · 游戏调查档案馆 =="
echo "仓库：${REPO_URL}"
echo "安装路径：${DEST}"
echo "端口：${PORT:-5699}；默认绑定：${BIND_ADDR:-0.0.0.0}"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "缺少 git。Debian/Ubuntu: apt-get update && apt-get install -y git" >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "缺少 Docker Engine 或 Docker Compose v2。" >&2
  echo "安装说明：https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if [[ -d "${DEST}/.git" ]]; then
  origin="$(git -C "$DEST" remote get-url origin)"
  case "$origin" in
    "https://github.com/lssopk/umineko-casebook.git"|"https://github.com/lssopk/umineko-casebook"|"git@github.com:lssopk/umineko-casebook.git"|"ssh://git@github.com/lssopk/umineko-casebook.git")
      ;;
    *)
      echo "拒绝覆盖：${DEST} 已关联其他仓库：${origin}" >&2
      exit 1
      ;;
  esac
  if [[ "$origin" != "$REPO_URL" ]]; then
    echo "检测到旧 GitHub SSH 地址，切换为无需密钥的 HTTPS..."
    git -C "$DEST" remote set-url origin "$REPO_URL"
  fi
  echo "检测到已有项目，更新 main 分支..."
  git -C "$DEST" pull --ff-only
elif [[ -e "$DEST" ]]; then
  echo "安装路径已存在且不是 Git 仓库：${DEST}。请设置 DEST 指定新目录。" >&2
  exit 1
else
  echo "首次安装，下载项目..."
  git clone --branch main "$REPO_URL" "$DEST"
fi

echo "构建并启动 Docker 服务..."
cd "$DEST"
bash ./deploy.sh
