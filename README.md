# 游戏调查档案馆 / Umineko Casebook

> 自托管的《海猫鸣泣之时》EP1–EP8 分章回顾、事件时间线、角色关系、证据索引与推理笔记网站。中文 UI，移动端适配。**默认所有剧情全部封存**。不包含原作游戏素材、游戏文件、音频或受版权保护的长篇原文。

## 功能

- 全 8 章，每章独立的章节回顾、主要人物关系、关键事件时间线、未决疑点、章节注意事项和茶会讨论索引。
- **强防误触剧透**：登录后仍需按顺序确认通关并手动输入 `EPn`；未解锁章节不提供正文 API，人物与内容不预加载。AI 读写权限受全局确认解锁进度限制。
- 人物关系图（点击查看人物关系、关系筛选、放大缩小）、事件类别筛选、证据搜索、个人推理笔记。
- 旧版个人推理草稿可继续保存于浏览器本地并导出 JSON；新版提交的假说和章节留言还会写入服务端受密码保护的推理室，供 AI 回复。**请分别备份本地草稿与服务端 Docker volume。**
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

**安全注意**：v2 已增加管理员密码登录；任何人若获得管理员密码，仍可在登录后主动解锁章节、提交请求消耗 AI API 额度。建议使用 HTTPS、强密码并限制访问。建议使用 HTTPS 反向代理和访问控制，不要将 VPS 管理端口一起开放。默认监听所有网络**接口**，并不是监听所有 TCP 端口；服务端口仍为 **5699**。

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
2. 浏览器登录后发起 POST `/api/unlock` 必须按顺序解锁。用户需自行确认阅读了对应章节的正篇、茶会和 `????`，手动键入 EP 编号。不存在“自动判断游戏进度”。
3. HTTP-only HMAC 签名 cookie 记录可读至哪一章，服务器端持久保存签名密钥于 Docker volume `casebook-state`。网站进度是**当前浏览器独立的**，更换浏览器需重新解锁。
4. 搜索、关系图、时间线只操作刚刚获授权的当前章节内容；不会跨章搜索未来资料。
5. 本站的章节锁是**防误触，不是内容保密**。v2 页面有管理员登录，但**公开 GitHub 仓库中的 `chapters/*.json` 仍可由任何人直接查看**，并不受网站登录保护。需要严格保密请使用私有仓库与访问控制。
6. 当前整章统一解锁，建议先看完该章正篇与茶会、`????` 再解锁。本项目没有每个附录独立解锁功能。
7. v2 需要管理员密码登录。管理员凭据、AI Key 与讨论记录保存在私人 Docker volume 中；勿将任何凭据提交 GitHub。

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


## 管理员登录、每章讨论与 Codex/AI（v2）

本项目现在使用**管理员密码**保护网页、章节与留言。首次安装/升级运行 `./deploy.sh`，会在公网启动前检测并要求设置至少 12 字符的密码；旧浏览器的章节进度会在登录后保留并同步解锁上限。

**AI 的两种工作方式**：

- **站内自动回复（推荐）**：复制 `.env.example` 为 `.env`，配置 **模型 API 密钥** `AI_API_KEY`、`AI_MODEL` 等，重新运行 `./deploy.sh`；内置 worker 每 60 秒检查留言，网页每 30 秒刷新。默认为每天最多 25 次模型回复，**与 ChatGPT Plus/Pro 订阅额度无关**，会按 API 提供商收费。
- **外部 Codex / Agent**：通过 `docker compose exec casebook node manage.js create-key --name codex` 创建独立可撤销 Token，然后让长期运行的 Agent 按 [AI 操作指南](docs/AI_OPERATIONS.md) 每分钟查询任务、提交回复、编辑当前已解锁章节。不必把管理员密码交给 AI；Codex 云端单次运行不会自动变成常驻服务。

每一章都有留言表单；「个人推理室」新建假说也会同步进服务器，供 AI 逐条论证。对“内容太简单”的留言，AI 可以提出具体扩写建议；内置 worker 默认**只回复建议**，不会修改旧章节。设置 `AI_AUTO_EDIT=1` 才会把未核验的 AI 扩写作为新段落追加进当前章节概览；外部授权智能体可 PATCH 每章 `lead/overview/events/mysteries/characters/links/tips/tea` 等字段，修改持久保存在专属 Docker volume 中。**所有改写都必须严格防止后续章节剧透。**

- AI 规范：[docs/AI_OPERATIONS.md](docs/AI_OPERATIONS.md)
- Codex 自动发现：[AGENTS.md](AGENTS.md)
- 站点配置示例：[.env.example](.env.example)
- 更改管理员密码：`docker compose exec -T casebook node manage.js set-password --stdin`，须从标准输入提供新密码。

### 完全卸载（会删除全部服务器数据）

```bash
cd ~/umineko-casebook
bash ./uninstall.sh --purge
```

按提示键入 **`DELETE-UMINEKO`**。此命令将删除本项目的 Docker 容器、专用镜像、Compose 数据卷（包含管理员密码、AI Token、章节编辑和讨论消息）及项目目录；不可恢复。不会删除其他 Docker 项目、全局 Docker 安装、GitHub 仓库、外部备份或浏览器中原有的 LocalStorage 笔记。反向代理及防火墙规则需另行清理。


### AI 管理后台、连接诊断和运行日志

登录网站后，点击顶部「AI 后台」，或打开 `/ai-admin.html`。此页面需要管理员会话，不向浏览器暴露 API 密钥。

- 查看模型是否配置、模型名、API 基础地址、轮询间隔、每日上限和是否自动编辑章节。
- 点击「测试模型连接」：服务器请求 `GET {AI_BASE_URL}/models/{AI_MODEL}`，验证网络、Bearer 密钥和模型读取权限，记录 HTTP 状态、耗时与请求 ID；**不生成内容，不代表聊天生成一定成功**。某些 OpenAI 兼容提供商不支持该接口，可能测试失败但聊天正常。
- 查看待处理、执行中、已完成、失败任务和最近 100 条审计日志。日志保存在 Docker 数据卷 `ai-logs.json`，最多保留 500 条，不记录密钥或对话正文。日志包含模型请求成功/失败、耗时和 Token 用量（提供商返回时）。
- 在服务器修改 `.env` 的 `AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` 后运行 `./deploy.sh` 重建容器使配置生效。可用 `docker compose logs --tail=100 casebook` 排查服务器错误。

注意：页面仅展示服务器本机的内置 AI worker 状态。独立 Codex/Agent 的调用不会被统计为内置模型调用；其任务处理结果可在任务列表中查看。
