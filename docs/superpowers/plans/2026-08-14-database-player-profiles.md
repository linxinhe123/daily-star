# 数据库球员标准档案实施计划

**Goal:** 为数据库 200 名球员生成与莫德里奇同结构的可展示档案，同时保留人工精选内容优先级。

**Architecture:** 新增离线身份同步器，将 TheSportsDB 与本地中文表合并成生成快照；前端通过统一适配层把身份、StatBunker 统计和精选资料合并。详情组件按数据可用性显示模块。

**Tech Stack:** Node.js、SQLite、Vue 3、TypeScript、Vite。

## Global Constraints

- 每日猜球只使用现有 20 名精选球员。
- 网页运行时不请求第三方接口。
- 不伪造荣誉、身价或国家队数据。
- 不覆盖用户当前工作区的无关修改。

### Task 1: 离线身份同步

**Files:**
- Create: `data/player-localizations.json`
- Create: `scripts/sync-player-identities.mjs`
- Generate: `data/player-identities.json`
- Generate: `apps/web/src/generated/player-identities.json`
- Modify: `package.json`

- [ ] 为 200 名球员维护常用中文名。
- [ ] 从 TheSportsDB 匹配球员并缓存身份字段。
- [ ] 下载可用球员照片到本地资源目录。
- [ ] 输出覆盖率报告，中文名缺失时失败。

### Task 2: 统一档案适配层

**Files:**
- Modify: `apps/web/src/players.ts`
- Modify: `apps/web/src/player-data.ts`

- [ ] 合并精选资料、自动身份和 StatBunker 统计。
- [ ] 从赛季记录生成当前俱乐部和俱乐部履历。
- [ ] 精选字段覆盖自动字段。

### Task 3: 完整详情展示

**Files:**
- Modify: `apps/web/src/App.vue`
- Modify: `apps/web/src/styles.css`

- [ ] 档案列表展示中文名和球员视觉。
- [ ] 详情首屏展示完整身份，不再出现占位文案。
- [ ] 根据内容动态显示概览、数据、生涯、荣誉和问球星。
- [ ] 没有照片时使用俱乐部队徽封面。

### Task 4: 生成与验收

- [ ] 运行身份和统计同步。
- [ ] 运行 `pnpm --filter @daily-star/web build`。
- [ ] 从首页进入档案并验证伊萨克、莫德里奇和一名无照片球员。
- [ ] 验证桌面端及 393px 移动端无横向滚动和控制台错误。
