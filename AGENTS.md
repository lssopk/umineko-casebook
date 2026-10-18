# Codex / AI Agent Instructions

在本仓库中，如果用户要求处理《海猫》玩家推理、章节留言、扩写章节资料、人物关系和证据，不要只改动仓库源文件：这些是**网站运行时数据库（Docker volume）里的资料**。

请务必先阅读 [`docs/AI_OPERATIONS.md`](docs/AI_OPERATIONS.md)。用户仅需提供 `CASEBOOK_BASE_URL`（HTTPS）和 `CASEBOOK_AGENT_TOKEN`（安全的环境变量），即可用真实 API 查找任务、回复、扩写章节。不需要网页登录的管理员密码，也无需直接使用 SSH/GitHub 改章节。

严格遵守章节解锁边界；不得提前泄露后续剧情。玩家假说需要严谨的证据链、反证与独立意见，不得机械附和。凡提交 PATCH 前要 GET 原文，保护结构和已存在证据。密钥不可输出到日志/聊天/代码。没有外部持续运行的调度器，云端 Codex 不会因为有文档就自动每分钟运行；项目附带独立可选的 OpenAI-compatible worker。
