# AI / Codex 独立智能体操作协议 · 海猫专属档案馆 v2

本协议供 Codex、ChatGPT Work、Claude Code、其他支持 HTTPS 的 AI agent 与本馆对接。

**三样输入**：`CASEBOOK_BASE_URL`（HTTPS 站点根地址）、`CASEBOOK_AGENT_TOKEN`（独立密钥，建议作为 Secrets 安全注入）、本文件 URL：

`https://github.com/lssopk/umineko-casebook/blob/main/docs/AI_OPERATIONS.md`

**非常重要：** 网站已内置一个可选的每 60 秒轮询的 OpenAI-compatible 模型工作器。它需要单独的模型 API Key 和 API 计费，与 ChatGPT Plus/Pro 登录和订阅额度**不是一回事**。外部 Codex 也可以通过这里的任务 API 每分钟轮询，但需要你自己运行一个持续在线的 agent/cron。仅仅提供 Codex 登录信息，**不会**自动产生 24 小时常驻智能体。两种方案任选一种即可，避免重复回复。

## 一、后台 API 认证

不需要网页登录，也不需要管理员密码。Agent 的专用 Token 与管理员账号完全隔离。

登录认证（无 session，Bearer Token 即凭证）：

```http
GET /api/agent/me
Authorization: Bearer cbk_********************************
```

响应示例：`{"ok":true,"actor":"agent","scopes":["jobs:read", "jobs:write", "chapters:read", "chapters:write", "messages:read", "messages:write"],"maxEpisode":1}`。

Token 由管理员在 VPS 运行（输出仅一次）：

```bash
cd ~/umineko-casebook
docker compose exec casebook node manage.js create-key --name codex
docker compose exec casebook node manage.js list-keys
docker compose exec casebook node manage.js revoke-key KEY_ID
```

Token 仅用于 HTTPS 服务端 API，绝不放进网页、GitHub 仓库、前端 JavaScript、公开日志、截图或聊天记录。AI 不应回显它。若丢失或泄露，撤销并重建。

## 二、防剧透第一准则

- **只讨论玩家已经明确完成并在网站逐章解锁的 EP。** 查询到 `maxEpisode` 不等于玩家允许 AI 利用这之前每章的最终解答；用户提出的当前话题有自己的进度边界。
- 服务端会拒绝读取/编辑超过全局已确认解锁章数的章节；**切勿试图绕过限制**。
- AI 只能参考领取任务返回的 **当前 EP 档案**、同章已确认的玩家发言，以及玩家明确提供的信息。即使模型自己知道结局，也**不准**提前揭晓/暗示真相、隐藏身份、后续死亡者、真正凶手和未来反转。
- 角色陈述、画面、作品说明和推测必须分别标注。使用**假说**而非凭空宣称“正确答案”。
- 个人推理室是平等对话：指出有力的地方，也用具体证据和替代假说反驳漏洞，不迎合猜测。适度幽默可以，但不要把自己伪装成真人玩家。
- 除非用户明确要求且在同章已验证，不要引用网上结局资料，不要大段复制受版权保护的游戏原文。

## 三、每 60 秒轮询 / 外部 Codex 执行流程

工作器主动执行（只要自己在线且具备 HTTP 客户端即可）：

1. `GET /api/agent/me` 检查凭据与进度。
2. `GET /api/agent/jobs` 获取待处理任务，返回 `{"jobs":[{..."id":"j_...","message":{...}}]}`，最多 10 条。**没有任务就退出这次循环，不消耗模型额度**。
3. `POST /api/agent/jobs/{id}/claim`，`Content-Type: application/json`，body `{}`。只有 claim 成功才能回复；领取成功返回任务原留言与**同一 EP 的章节材料**。默认保留 5 分钟领取租约。
4. 分析用户留言：`discussion` 为问题/讨论，`hypothesis` 为个人假说，`improve` 为扩写或纠错请求。形成有逻辑论证：**问题界定 → 本章事实与来源 → 分步推导 → 不确定性和反证 → 独立观点/可验证预测**。不得凭空编造事件细节；若信息不足就提出澄清问题。
5. `POST /api/agent/jobs/{id}/complete`，JSON `{ "reply": "完整、有自己观点的回复……" }`。完成后该回复会自动显示在玩家留言下，网页每 30 秒刷新留言区。
6. 暂时处理失败可 `POST /api/agent/jobs/{id}/fail`，JSON `{ "error":"失败原因" }`；失败原因不可包含密钥。
7. 每 60 秒再次执行。**只有外部运行环境/cron 存在时才会持续轮询；云端 Codex 单次会话不会因此变成常驻进程。**

**示例 curl（已通过 Secrets 配置变量）：**

```bash
API="${CASEBOOK_BASE_URL%/}/api/agent"
curl -fsS "$API/me" -H "Authorization: Bearer $CASEBOOK_AGENT_TOKEN"
curl -fsS "$API/jobs" -H "Authorization: Bearer $CASEBOOK_AGENT_TOKEN"
# 使用实际返回的 JOB_ID
curl -fsS -X POST "$API/jobs/$JOB_ID/claim" \
  -H "Authorization: Bearer $CASEBOOK_AGENT_TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
curl -fsS -X POST "$API/jobs/$JOB_ID/complete" \
  -H "Authorization: Bearer $CASEBOOK_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"reply":"这里应放 AI 针对本章推理的完整论证。"}'
```

网络超时可能已在服务器提交，重试前必须重新 GET jobs 或检查留言，避免重复回复。400 表示 JSON/字段错误；401 表示登录失败；403 表示权限或章节限制；404 表示不存在；409 表示任务已被其他 worker 领取或已完成。

## 四、编辑 EP1–EP8 每章内容（安全可控）

编辑 API **只对已解锁章节开放**，需要 `chapters:read` 和 `chapters:write` scope。修改保存在 Docker 专用数据卷中的 `chapter-edits/`，**不直接覆盖 GitHub 原始 JSON**。重建容器/更新版本保留修订，完全卸载删除修订。

```http
GET /api/agent/chapters/1
Authorization: Bearer cbk_...
```

返回 `{ "chapter": { ... } }`。`PATCH /api/agent/chapters/1` 支持 JSON：

```json
{
  "changes": {
    "lead": "本章更充分的导读文字（不使用未来信息）",
    "overview": [
      "第一段：当前 EP 中已知的人物动机、争论焦点与可证实事实。",
      "第二段：事件与证言之间的联系、何处是推论和逻辑空白。",
      "第三段：提出多种可能解释及其成立前提、现存反证。"
    ]
  }
}
```

可更新字段：`title`、`en`、`lead`、`overview`、`events`、`mysteries`、`links`、`tips`、`tea`、`characters`。不允许改动 `id`。`overview/tips/tea` 为文本数组；其余数组须保留原结构对象的必要字段：

- `events`：`[{"time":"10/04","title":"...","text":"...","kind":"证词"}]`；
- `mysteries`：`[{"id":"EP1-01","title":"...","question":"...","kind":"待验证"}]`；
- `characters`：`[{"id":"...","name":"...","role":"...","group":"家族"}]`；
- `links`：`[{"from":"...","to":"...","kind":"亲子"}]`。

**注意：PATCH 数组是整字段替换，不是增量追加。** 必须先 GET 获取整个对象，在本章旧数组上补充，保留已有正确事实、对象 ID、人物连线，再提交**完整新数组**。建议单次只修订一个字段；不可为了“写得更全面”删掉以前的证据或改变已核查的时间顺序。

完成后用 GET /api/agent/chapters/{n} 再次核实。**权限允许修改 ≠ 作品真实事实已经核实**：有争议的内容应保留“不确定”及依据来源。

## 五、章节留言与推理对话

- 玩家从网站某一 EP 的「章节讨论 / 推理室」发言，服务端存储消息并创建任务。
- 浏览器经过管理员密码登录且解锁相应章后：`GET /api/room/{ep}/messages`（讨论列表），`POST /api/room/{ep}/messages` 创建消息。消息正文上限 8000 字，type 只能为 `discussion`、`hypothesis`、`improve`，可选 parentId。
- 外部 AI Token 可在已允许章节读取消息、写入自己留言；**标准推荐使用 job complete 回复**，因为它自动和原消息建立父子关系，并防止重复处理。
- 对“这一章讲得太简单，帮我完善”的 `improve` 类型：先输出可检验的扩写建议、指出应该增加哪条证据和逻辑链接，**再使用章节 PATCH 接口按现有结构精修**。尽量用不同的现有本章证据建立推理链；不要凭空引用游戏的其他章节。
- 推理与猜测的结构建议：主张 / 基于本章的证据 / 逻辑步骤 / 可替代解释 / 尚未解决的反例 / 玩家可继续关注的问题。

## 六、内置 60 秒 AI 模型 worker（不运行 Codex 也可自动回复）

如果只想通过网页登录、留言、等一小会儿就收到 AI 回复，**推荐这个方案**。在 VPS 的项目目录创建 `.env`（复制 `.env.example`），设置：

```dotenv
PUBLIC_HTTPS=1
AI_API_KEY=只在服务器保存的模型提供商API密钥
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
AI_DAILY_LIMIT=25
AI_AUTO_EDIT=0
```

`AI_API_KEY` 是来自模型服务商的**API**密钥，不是 ChatGPT 网页登录 Cookie 或订阅密码。每个模型调用按提供商 API 计费；请按需设定预算与额度。运行 `chmod 600 .env && ./deploy.sh` 后后台每 **60 秒**检查待处理任务，一次最多处理一条；当没有留言、讨论时不会主动发模型请求。页面每 30 秒刷新显示。默认每日最多 25 条模型回复（**计数存于进程内，重启会清零**）。

默认 **AI_AUTO_EDIT=0**：AI 会完整回复扩写建议，但不擅自修改正文，以免模型生成未来剧透污染已完成的章节。若你愿意让内置模型把「扩写请求」回复以**明确标注的未核验草稿**附加进当前 EP 概览，可设 `AI_AUTO_EDIT=1` 后重启。原概览不会被覆盖；不过模型仍可能出错或剧透，建议核实。对精准修订，请使用外部 agent 的 `PATCH` 接口。

务必不要同时运行内置 worker 与另一套不断领取同一任务的外部 Codex，避免竞争与额外模型消耗。开启工作器前建议先配置 HTTPS 反向代理，只让自己知道管理员密码；服务器监听 5699 时访客仍会看到密码登录页面，无法直接创建任务。反代服务最好再增加速率限制。

## 七、成本与安全

- 所有档案页面需要**管理员密码**，没有密码的访客不能加载正篇、提交留言或触发 AI 模型额度。
- Agent 不使用管理员密码，只使用可撤销的 Bearer Token；后端不向前端返回 Token 或模型密钥。
- 每次执行遵守章节锁与全局已确认的最大章节，不要向未解锁章节发送 AI 解析或主动解锁。
- 备份服务端 Docker volume（包含讨论、文章修订、管理员账户和 API Key）。浏览器原来的本地推理备份也建议另外导出。
- API 模型费用应设置提供商侧预算和额度限制；本项目的本地速率限制不等于财务上的费用保证。

## 八、给外部 AI 的标准操作指令

> 你是《海猫鸣泣之时》调查档案馆的推理搭档。请阅读本文件，使用 CASEBOOK_BASE_URL 和 CASEBOOK_AGENT_TOKEN 验证连接。每分钟执行一次待办检查（需要你所在环境的调度器持续运行），优先处理新评论与玩家假说。针对当前 EP，做完整、严谨的证据链分析，主动提出自己的可反驳观点，说明其他可能解释。对完善档案的请求先核查本章原有数组结构，再精准 PATCH；任何情况下都不使用未来章节和最终谜底，不自行解锁，不泄露密钥。遇到缺信息保持不确定。只有 API 返回成功才报告已写入。
