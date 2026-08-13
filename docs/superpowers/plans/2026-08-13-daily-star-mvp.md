# 每日一星 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个移动端优先的每日足球猜谜、球星档案和 AI 追问网站，首批提供 20 名完整球员数据，并能部署到现有 2GB 云服务器。

**Architecture:** pnpm workspace 包含 Vue 3/Vite Web 和 Fastify API。共享 contracts 定义球员、每日竞猜和 AI 回答结构；球员资料保存在可审阅 JSON 中，SQLite 固化每日选星记录，浏览器 localStorage 保存匿名竞猜进度。API 使用兼容 OpenAI/DeepSeek 的模型接口，先把本地球员档案放入上下文，模型不可用时仍保留完整竞猜与阅读体验。

**Tech Stack:** Vue 3, TypeScript, Vite, Vue Router, Pinia, Fastify, Zod, better-sqlite3, Vitest, Playwright, Docker, Nginx

## Global Constraints

- 只包含男足球员；第一批 20 人，数据模型允许扩充到 200 人。
- 每天北京时间 00:00 切换，同一球员 365 天内不重复。
- 页面支持 360×800、390×844、768×1024 和 1440×900。
- 球员图片必须保存来源与许可证；没有合规图片时使用剪影档案卡。
- 不复制 EA FC 或 In The Game 的品牌、源码、卡面轮廓和专有评分。
- AI 不能编造资料；本地档案不足时明确说明，联网搜索作为后续可插拔能力。
- 服务端不保存用户完整自由输入问题；第一版不要求登录。

---

### Task 1: Workspace 与共享契约

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/contracts.test.ts`

**Interfaces:**
- Produces: `PlayerProfile`, `DailyChallenge`, `GuessResult`, `AskPlayerInput`, `PlayerAnswer` Zod schemas and inferred types.

- [ ] 写契约测试，断言球员必须有 5 条线索、图片署名或明确 fallback、至少一项来源。
- [ ] 运行 `pnpm --filter @daily-star/contracts test`，确认因契约缺失而失败。
- [ ] 实现契约和 workspace 配置。
- [ ] 再次运行契约测试并确认通过。
- [ ] 提交 `feat: add daily star contracts`。

### Task 2: 20 人球员资料与校验器

**Files:**
- Create: `data/players/*.json`
- Create: `data/sources.json`
- Create: `scripts/validate-players.ts`
- Create: `scripts/validate-players.test.ts`

**Interfaces:**
- Consumes: `PlayerProfile` schema.
- Produces: `loadValidatedPlayers(): PlayerProfile[]` and 20 ready player records.

- [ ] 写资料校验测试，覆盖重复 slug、别名冲突、少于 5 条线索、缺失图片许可和无来源事实。
- [ ] 运行测试并确认失败。
- [ ] 实现校验器和 20 名首发球员资料：梅西、C 罗、马拉多纳、贝利、克鲁伊夫、贝肯鲍尔、齐达内、罗纳尔多、罗纳尔迪尼奥、亨利、马尔蒂尼、卡卡、哈维、伊涅斯塔、布冯、诺伊尔、莫德里奇、萨拉赫、姆巴佩、孙兴慜。
- [ ] 运行 `pnpm validate:data` 并确认 20/20 ready。
- [ ] 提交 `feat: add first player collection`。

### Task 3: 每日选星与竞猜领域逻辑

**Files:**
- Create: `packages/game/package.json`
- Create: `packages/game/src/daily-selection.ts`
- Create: `packages/game/src/guessing.ts`
- Create: `packages/game/src/game.test.ts`

**Interfaces:**
- Produces: `selectDailyPlayer(date, players, history)`, `normalizePlayerName(name)`, `evaluateGuess(player, input, attempt)`, `buildMultipleChoice(player, pool, date)`.

- [ ] 写测试：北京时间日期稳定、365 天冷却、中文/英文/别名匹配、重音和标点归一化、第三次出现四选一。
- [ ] 运行测试并确认失败。
- [ ] 实现纯函数领域逻辑，选择种子使用日期字符串哈希，服务端历史记录优先于重新计算。
- [ ] 运行测试并确认通过。
- [ ] 提交 `feat: implement daily guessing rules`。

### Task 4: Fastify API 与 SQLite 日记录

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/repository.ts`
- Create: `apps/api/src/routes/challenge.ts`
- Create: `apps/api/src/routes/players.ts`
- Create: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `GET /api/health`, `GET /api/challenge/today`, `POST /api/challenge/guess`, `POST /api/challenge/reveal`, `GET /api/players/:slug`, `GET /api/archive`.

- [ ] 写 Fastify inject 集成测试，覆盖当日内容隐藏、猜错解锁、猜中揭晓、直接揭晓、档案查询和 404。
- [ ] 运行测试并确认失败。
- [ ] 实现 SQLite `daily_challenges(date, player_slug, created_at)` 与路由；客户端提交尝试次数，服务端只返回当前允许的线索与答案状态。
- [ ] 运行 API 测试并确认通过。
- [ ] 提交 `feat: add daily star api`。

### Task 5: AI 追问服务

**Files:**
- Create: `apps/api/src/ai/player-agent.ts`
- Create: `apps/api/src/routes/ask.ts`
- Create: `apps/api/src/ai/player-agent.test.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `POST /api/players/:slug/ask` returning `{ answer, citations, confidence, mode, opinion }`.

- [ ] 写测试：系统提示包含当前球员资料与来源；回答结构异常时降级；没有 key 时返回基于档案的确定性回答或明确边界。
- [ ] 运行测试并确认失败。
- [ ] 实现 OpenAI-compatible Chat Completions 调用，支持 `LLM_BASE_URL`、`LLM_API_KEY`、`LLM_MODEL`，20 秒超时和结构验证。
- [ ] 运行测试并确认通过。
- [ ] 提交 `feat: add sourced player assistant`。

### Task 6: Web 状态、路由与本地持久化

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.ts`
- Create: `apps/web/src/router.ts`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/stores/challenge.ts`
- Create: `apps/web/src/stores/challenge.test.ts`

**Interfaces:**
- Produces: challenge store actions `loadToday`, `submitGuess`, `reveal`, `restoreLocalState`; routes `/`, `/archive`, `/player/:slug`, `/sources`, `/about`.

- [ ] 写 store 测试，覆盖刷新恢复、日期变化清空旧状态和请求失败保留缓存。
- [ ] 运行测试并确认失败。
- [ ] 实现 API client、路由和 localStorage 状态版本化。
- [ ] 运行测试并确认通过。
- [ ] 提交 `feat: add challenge web state`。

### Task 7: 每日竞猜与揭晓卡 UI

**Files:**
- Create: `apps/web/src/App.vue`
- Create: `apps/web/src/pages/TodayPage.vue`
- Create: `apps/web/src/components/PlayerCard.vue`
- Create: `apps/web/src/components/ClueStack.vue`
- Create: `apps/web/src/components/GuessComposer.vue`
- Create: `apps/web/src/styles/tokens.css`
- Create: `apps/web/src/styles/global.css`
- Create: `apps/web/src/pages/TodayPage.test.ts`

**Interfaces:**
- Consumes: challenge store and `DailyChallenge`.
- Produces: responsive guessing flow with free input, four choices, reveal state and reduced motion support.

- [ ] 写组件测试，覆盖两次自由输入、第三次四选一、直接揭晓和正确答案状态。
- [ ] 运行测试并确认失败。
- [ ] 实现“收藏球星卡 + 足球档案馆”视觉：深炭黑、草场绿、比赛橙、纸白和中性灰；卡片保持固定比例，移动端输入栏位于安全区上方。
- [ ] 运行测试并确认通过。
- [ ] 提交 `feat: build daily reveal experience`。

### Task 8: 档案、追问、往期与来源页面

**Files:**
- Create: `apps/web/src/components/PlayerStory.vue`
- Create: `apps/web/src/components/CareerTimeline.vue`
- Create: `apps/web/src/components/PlayerChat.vue`
- Create: `apps/web/src/pages/ArchivePage.vue`
- Create: `apps/web/src/pages/PlayerPage.vue`
- Create: `apps/web/src/pages/SourcesPage.vue`
- Create: `apps/web/src/pages/AboutPage.vue`
- Create: `apps/web/src/pages/content.test.ts`

**Interfaces:**
- Consumes: player detail and ask endpoints.
- Produces: three-minute dossier, AI chat, archive, shareable player page and attribution display.

- [ ] 写组件测试，确保来源、图片署名、AI 引用、观点标识和失败状态可见。
- [ ] 运行测试并确认失败。
- [ ] 实现档案时间线、故事、推荐比赛、追问室和次级页面。
- [ ] 运行测试并确认通过。
- [ ] 提交 `feat: add player archive and assistant`。

### Task 9: Docker、Nginx 与端到端验证

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `docker/nginx.conf`
- Create: `apps/web/e2e/daily-star.spec.ts`
- Create: `playwright.config.ts`

**Interfaces:**
- Produces: API container and Nginx web container; web proxies `/api` to API.

- [ ] 写 Playwright 流程：加载今日球星、猜错两次、出现四选一、揭晓、阅读档案、打开 AI 追问。
- [ ] 分别在 360×800、390×844、768×1024、1440×900 运行并确认初始失败。
- [ ] 实现容器和响应式修复，检查键盘/固定输入区无内容遮挡。
- [ ] 运行 `pnpm test`, `pnpm build`, `pnpm e2e` 并确认通过。
- [ ] 使用截图检查卡片非空、移动端无溢出、桌面正文宽度合理。
- [ ] 提交 `chore: prepare daily star deployment`。
