#!/usr/bin/env bash
# Run only after publishing the repository to GitHub.
set -Eeuo pipefail
: "${REPO_URL:?请通过环境变量 REPO_URL 指定 GitHub 仓库 git 克隆地址}"
DEST="${DEST:-/opt/umineko-casebook}"
if ! command -v git >/dev/null; then echo '请先安装 git';exit 1;fi
if [[ -e "$DEST" ]]; then echo "目录 $DEST 已存在。为避免覆盖文件，安装已停止。请手工 git pull 更新。";exit 1;fi
git clone --depth 1 "$REPO_URL" "$DEST"
cd "$DEST"
./deploy.sh
