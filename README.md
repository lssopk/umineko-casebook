# 游戏调查档案馆 / Umineko Casebook

> 自托管的《海猫鸣泣之时》EP1–EP8 分章回顾、事件时间线、角色关系、证据索引与推理笔记网站。中文 UI，移动端适配。**默认所有剧情全部封存**。不包含原作游戏素材、游戏文件、音频或受版权保护的长篇原文。

## 功能

- 全 8 章，每章独立的章节回顾、主要人物关系、关键事件时间线、未决疑点、章节注意事项和茶会讨论索引。
- **强防误触剧透**：未解锁章节的名称与人物不展示；章节 JSON 放在服务端私有目录；API 对未解锁章节返回 HTTP 403；不预加载、不全文搜索未来章节；需要按顺序解锁、勾选完整通关确认并手动输入 `EPn` 才可打开；可随时重新封存。
- 人物关系图（点击查看人物关系、关系筛选、放大缩小）、事件类别筛选、证据搜索、个人推理笔记。
- 个人推理笔记仅存在浏览器本地，可导入导出 JSON，不需要账户。**清除网站数据会失去未备份的笔记及解锁进度**。
- 夜间/日间阅读、移动版底部导航，无外部 CDN 依赖。
- 原生 Node.js HTTP 服务（0 npm 运行时依赖），Docker Compose 容器部署与健康检查。

**内容覆盖说明**：当前为 8 个 EP 的**章节核心事件与推理导览版**（45 条事件、各章疑点和注意事项），不是每个事件的逐场证词校勘、全部杀人手法谜底集或原作全文。对仍有争议的解释采取谨慎措辞。更新内容可以编辑 `chapters/epNN.json`。

## VPS 一键部署（端口 5699）

环境：Linux VPS（Debian/Ubuntu 优先），已安装 Git、Docker Engine 和 Docker Compose v2。

**方式一：公共仓库一键安装/更新（推荐）**

```bash
curl -fsSL https://raw.githubusercontent.com/lssopk/umineko-casebook/main/install.sh | bash
```

无需 GitHub SSH 公钥。默认安装路径 `~/umineko-casebook`，已有安装会使用 `git pull --ff-only` 更新并重建 Docker 容器，不删除 Docker volume 数据。默认公网绑定 `0.0.0.0:5699`。如果要恢复仅本机绑定，可进入项目执行 `BIND_ADDR=127.0.0.1 ./deploy.sh`。

**方式二：手动 HTTPS 克隆**

```bash
git clone https://github.com/lssopk/umineko-casebook.git
cd umineko-casebook
./deploy.sh
```

**方式三：使用下载的 ZIP**

```bash
unzip umineko-casebook-v1.0.zip
cd umineko-casebook
./deploy.sh
```

**现在默认监听 `0.0.0.0:5699`，可从 VPS 公网 IPv4 的 5699 端口访问。** 部署脚本在 UFW/firewalld 已启用时会尝试放行 TCP 5699；若 VPS 提供商有安全组、上游防火墙，请另外放行 TCP 5699。

```text
http://<VPS公网IP>:5699
```

健康检查：`curl http://127.0.0.1:5699/healthz`。

**如果与 Nginx/Caddy 反向代理部署在同一 VPS，建议仅绑定本机：**

```bash
BIND_ADDR=127.0.0.1 ./deploy.sh
```

此时反代目标为 `http://127.0.0.1:5699`。如果是**独立 Docker 容器内的 Nginx Proxy Manager**，容器内的 `127.0.0.1` 不是 VPS 主机，应配置正确的 Docker 网络或可达的宿主机 IP。

**安全注意**：本站没有用户账户密码，任何能访问网页的人都可以自行确认并解锁章节；直接公网开放仅适合你愿意共享的内容。建议使用 HTTPS 反向代理和访问控制，不要将 VPS 管理端口一起开放。默认监听所有网络**接口**，并不是监听所有 TCP 端口；服务端口仍为 **5699**。

升级代码：进入项目目录，`git pull && ./deploy.sh`。

操作命令：

```bash
docker compose logs -f --tail=100
docker compose ps
docker compose down                # 停服务，不删除状态
docker compose up -d --build       # 重建并启动
curl http://127.0.0.1:5699/healthz
```

**没有 Docker 的快速体验**（已安装 Node.js 22+）：

```bash
PORT=5699 HOST=127.0.0.1 node server.js
```

## 防剧透机制与限制

1. 前端只有安全的 8 章目录清单，以及每章**游玩前**提示；未解锁不会加载章节名称、人物或剧情。服务器 `chapters/` 不位于公开静态目录。
2. 浏览器发起 POST `/api/unlock` 必须按顺序解锁。用户需自行确认阅读了对应章节的正篇、茶会和 `????`，手动键入 EP 编号。不存在“自动判断游戏进度”。
3. HTTP-only HMAC 签名 cookie 记录可读至哪一章，服务器端持久保存签名密钥于 Docker volume `casebook-state`。网站进度是**当前浏览器独立的**，更换浏览器需重新解锁。
4. 搜索、关系图、时间线只操作刚刚获授权的当前章节内容；不会跨章搜索未来资料。
5. 这是一项**防误触设计，不是保密系统**：任何人都能主动点击确认并解锁；如果 GitHub 仓库是公开的，源码中的 `chapters/*.json` 也能被直接阅读。真正希望文件完全不公开的话，请设置私人仓库与访问控制。
6. 当前整章统一解锁，建议先看完该章正篇与茶会、`????` 再解锁。本项目没有每个附录独立解锁功能。
7. 不需要登录密码。勿将 OpenList 或 VPS 的凭据提交 GitHub；本工程**没有包含任何用户密码、token 或密钥**。

## 项目结构

```
server.js            Node.js 服务端、权限检查、静态资源路由
public/              可公开访问的网页和【无剧透】章节索引
chapters/ep01-08.json 服务端章节档案，仅解锁后通过 API 获取
compose.yaml         Docker 一键部署
Dockerfile           最小化 Node 镜像
state/               运行时 cookie 签名密钥（不入 Git、ZIP）
docs/                项目说明 / 测试预览
```

## 内容维护

- 修改 `chapters/epNN.json`，按现有数据结构新增/纠正主要事件、人物节点、边和疑点。
- 注意：**不能把 EP(n+1) 的推理结果写进 EPn**。新的人名、角色身份与核心谜底不应出现在 `public/manifest.json`，因为它是未解锁就能读取的。
- JSON 结构由 `create_content.py` 产生（首版整理脚本），如果手动修订 JSON，切勿随意重新运行生成脚本以免覆盖。
- 更新后运行 `./deploy.sh` 即可重建容器。

## 测试

```bash
node --check server.js
node --check public/app.js
python test_api.py    # 需在本机启动服务，依赖 requests
python test_site.py   # 仅开发测试，依赖 Playwright + Chromium
```

## 资料与版权

请参阅 [docs/SOURCES.md](docs/SOURCES.md)。本站为独立的读书/游戏调查笔记工具，非游戏的官方或授权再发布版本。所有概述以原创简述为主，未打包游戏 CG、立绘、音乐或游戏正文。
