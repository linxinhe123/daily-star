# 「猜球星」无限猜与档案补全实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前的每日单题改为全球员随机的「猜球星」，并修复档案、收藏、URL、搜索、问答、退役状态、身价与生涯轨迹。

**Architecture:** 将当前集中在 `App.vue` 的随机局、收藏和 URL 状态拆到专用 TypeScript 模块。数据管线使用 Transfermarkt 开放估值数据和已有球员 ID，将结果写入 SQLite 并导出静态 JSON；生涯轨迹与 StatBunker 赛事统计分开。

**Tech Stack:** Vue 3, TypeScript, Vite, Node.js, SQLite, Transfermarkt open data, existing StatBunker snapshots.

## Global Constraints

- 产品文案统一为「猜球星」，移除每日题目、今日编号和虚假连续签到。
- 每局从候选线索随机抽取并打乱 5 条，刷新时恢复本局顺序。
- 不伪造早期球员的历史身价，不将缺失赛事统计当作零数据。
- 不在浏览器运行时请求 Transfermarkt 或 StatBunker。
- 不引入账号系统、云同步或新的大型路由依赖。
- 按用户早先要求不走 TDD；不新建测试框架，使用类型检查、生产构建、数据审计和浏览器回归。

---

### Task 1: 随机线索与局状态

**Files:**
- Create: `apps/web/src/player-clues.ts`
- Create: `apps/web/src/game-session.ts`
- Modify: `apps/web/src/players.ts`
- Modify: `apps/web/src/App.vue`

**Interfaces:**
- `buildCluePool(player: Player, detail?: PlayerData): string[]`
- `createRandomGame(players: Player[], previousSlug?: string): GameSession`
- `loadGameSession(players: Player[]): GameSession`
- `saveGameSession(session: GameSession): void`
- `GameSession = { id, playerSlug, clues, attempt, status, message }`

- [ ] 从国籍、位置、职业年代、俱乐部轨迹、技术特点和已核验数据生成候选线索，保留精选球员人工线索。
- [ ] 只将至少有 5 条线索的球员纳入随机池，洗牌后取 5 条，避免连续两局同人。
- [ ] 使用 `localStorage` 持久化当前局和 `{ played, won }` 真实统计，损坏数据回退到新局。
- [ ] 将 `App.vue` 的题目球员与档案球员分离，「再猜一位」调用 `createRandomGame`，档案打开不修改题目。
- [ ] 移除 `seed % 365` 和固定连续 7 天，更新 logo、首页标题、规则和按钮文案。
- [ ] 运行 `pnpm --filter @daily-star/web build`，期望 TypeScript 和 Vite 构建成功。

### Task 2: URL 状态与可分享档案

**Files:**
- Create: `apps/web/src/navigation.ts`
- Modify: `apps/web/src/App.vue`

**Interfaces:**
- `parseLocation(players: Player[]): NavigationState`
- `pushNavigation(state: NavigationState): void`
- `playerUrl(slug: string): string`
- `NavigationState = { view: View; playerSlug?: string }`

- [ ] 解析 `/`、`?view=archive`、`?view=saved`、`?view=about` 和 `?player=<slug>`，无效 slug 回退档案列表。
- [ ] 导航、档案打开和关闭通过 History API 更新 URL，`popstate` 恢复视图和档案球员。
- [ ] 分享始终使用 `playerUrl(player.slug)`，不再分享主页。
- [ ] 手动验证直达、刷新、前进、后退和复制的球员 URL。

### Task 3: 收藏、搜索和图片降级

**Files:**
- Create: `apps/web/src/favorites.ts`
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/players.ts`

**Interfaces:**
- `loadFavoriteSlugs(): Set<string>`
- `saveFavoriteSlugs(slugs: Set<string>): void`
- `toggleFavorite(slug: string): Set<string>`

- [ ] 在详情页增加收藏/已收藏按钮，保存 slug 并即时更新状态。
- [ ] 收藏页用真实球员卡片展示收藏结果，空集合才显示空状态。
- [ ] 搜索字段扩展到中英文名、别名、国籍、位置和全部效力俱乐部，增加无结果提示和清空操作。
- [ ] 精选球员优先合并 `generated/player-identities.json` 的本地图片；图片失败时显示中文姓名和国旗。
- [ ] 在 390px 手机视口验证收藏页、无结果和图片降级无水平滚动。

### Task 4: 退役状态与问答真实性

**Files:**
- Modify: `apps/web/src/player-data.ts`
- Modify: `apps/web/src/player-biography.ts`
- Modify: `apps/web/src/App.vue`

**Interfaces:**
- `normalizeCurrentClub(value?: string, active?: boolean): string`
- `PlayerData.retired: boolean`

- [ ] 在数据合并层过滤 `_Retired Soccer` 和 `_Free Agent Soccer`，为退役球员设置 `retired: true` 和空 `currentClub`。
- [ ] 详情页、概览、线索和简介统一显示「已退役」，不渲染当前俱乐部指标。
- [ ] 问答按 `retired`、`marketValues.length`、`clubs.length`、`honorGroups.length` 和实际赛季数据组装回答。
- [ ] 用布冯验证页面和问答不再出现供应商占位值或虚假身价文案。

### Task 5: Transfermarkt 身价同步

**Files:**
- Create: `scripts/sync-transfermarkt-valuations.mjs`
- Create: `apps/web/src/generated/player-valuations.json`
- Modify: `data/daily-star.sqlite`
- Modify: `apps/web/src/player-data.ts`
- Modify: `package.json`

**Interfaces:**
- JSON: `{ generatedAt, players: Record<slug, { transfermarktId, points: { date, year, value, clubId }[] }> }`
- SQLite table: `player_market_values(player_slug, transfermarkt_id, value_date, market_value, club_id, source, updated_at)`

- [ ] 从 `data/statbunker-roster.json` 读取 200 人 Transfermarkt ID，下载或复用缓存的 `player_valuations.csv.gz`。
- [ ] 流式解析并仅保留目标 ID，按球员和日期去重、排序，事务写入 SQLite。
- [ ] 导出 JSON 快照和覆盖率统计，将数据映射到 `PlayerData.marketValues`。
- [ ] 更新 `MarketValuePoint` 保留真实日期，图表仅在显示层对过密节点抽样。
- [ ] 对无估值记录的早期球员显示真实边界文案，不生成零值曲线。
- [ ] 运行 `pnpm sync:valuations` 并记录球员总数、有节点球员数和总节点数。

### Task 6: 完整俱乐部生涯轨迹

**Files:**
- Create: `scripts/sync-player-careers.mjs`
- Create: `apps/web/src/generated/player-careers.json`
- Modify: `data/daily-star.sqlite`
- Modify: `apps/web/src/player-data.ts`
- Modify: `package.json`

**Interfaces:**
- JSON: `{ generatedAt, players: Record<slug, { transfermarktId, spells: { club, start, end, source }[] }> }`
- SQLite table: `player_career_spells(player_slug, transfermarkt_id, club_name, start_date, end_date, source, updated_at)`

- [ ] 使用 200 人 Transfermarkt ID 获取俱乐部历史，实施限速、原始响应缓存、单球员失败继续和覆盖率报告。
- [ ] 将球员经历按时间排序，合并连续的同俱乐部记录，保留非连续回归阶段。
- [ ] 事务写入 SQLite 并导出 JSON；前端优先使用完整轨迹，将 StatBunker 数据只附加到能匹配的俱乐部阶段。
- [ ] 优先审计所有 `active === false` 球员，生成缺失轨迹列表。
- [ ] 验证布冯轨迹包含帕尔马首次效力、尤文图斯、巴黎圣日耳曼、尤文图斯回归和帕尔马回归。
- [ ] 验证另外至少 4 名不同时代退役球员，早期统计缺失不显示为 0。

### Task 7: 整合质检

**Files:**
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/components/MarketValueChart.vue`
- Modify: `apps/web/src/player-data.ts`

- [ ] 运行 `pnpm --filter @daily-star/web build` 和 `git diff --check`。
- [ ] 从档案打开马尔穆什，开始新局，确认随机题目有 5 条线索且不受档案污染。
- [ ] 验证同一球员不同新局的线索顺序可变，刷新当前局不变。
- [ ] 验证布冯退役状态、完整轨迹、问答和无占位值；验证现代球员身价曲线。
- [ ] 验证收藏持久化、搜索位置/俱乐部、无结果、玩家 URL 直达和分享。
- [ ] 在桌面与约 390px 手机视口检查水平滚动、文字重叠、图片降级和控制台错误。

