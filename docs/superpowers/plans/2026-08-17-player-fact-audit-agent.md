# 球员全项目事实审计智能体实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立项目级 Codex 球员事实审计智能体，完成 199 名球员的全数据、内容与视觉资源审计，并把确认错误修正到权威源数据及全部派生产物。

**Architecture:** 使用 `.codex/agents/player-fact-auditor.toml` 定义项目级 Codex 自定义智能体；Node.js 校验器只处理可确定的一致性、资源和生成漂移检查，联网事实判断由 Codex 完成。审计状态按 `slug` 持久化，源数据修正后统一重建 CSV、SQLite 和前端生成文件，最终生成 JSON 与 Markdown 报告。

**Tech Stack:** Codex project-scoped custom agents、Node.js ESM、Node test runner、JSON、CSV、SQLite、Vue 3、TypeScript、pnpm、Vite。

## Global Constraints

- 审计目标仓库是 `D:\code\daily-star`，球员范围以 `data/statbunker-roster.json` 的 199 个 `slug` 为准。
- 不依赖独立的 OpenAI API 密钥；联网事实核验由用户在 Codex 中运行项目级自定义智能体完成。
- 官方来源可单独支持结论；否则需要两个相互独立且口径一致的可靠来源。
- 证据不足、来源冲突、统计口径不兼容或图片归属无法确认时保留当前值并标记 `待复核`，不得猜测。
- 只修改确认属于球员事实、数据一致性或资源归属问题的内容，保留工作区已有未提交改动。
- `data/` 是主要源数据层；CSV、SQLite 和 `apps/web/src/generated/` 通过现有脚本重建，不零散修补生成结果。
- 每个球员必须最终处于 `已通过`、`已修改` 或 `待复核`，不得静默跳过。

---

## File Structure

- `.codex/agents/player-fact-auditor.toml`：项目级 Codex 自定义智能体，定义联网证据、允许修改范围、逐人流程和完成门槛。
- `scripts/lib/player-audit-state.mjs`：审计状态 schema、源文件指纹、状态读取与原子写入。
- `scripts/lib/player-audit-checks.mjs`：跨文件身份、生涯、荣誉、内容和生成漂移的纯函数校验。
- `scripts/lib/player-audit-assets.mjs`：头像、队徽、国家队标志的路径、主键和文件签名检查。
- `scripts/player-audit.mjs`：`init`、`check`、`next`、`record`、`report` 命令入口。
- `scripts/player-audit.test.mjs`：状态机、确定性校验、资源检查和报告的 Node 测试。
- `data/audits/player-fact-audit.json`：199 人审计状态与逐项证据。
- `docs/audits/player-fact-audit-report.md`：面向人工审阅的全量汇总报告。
- `package.json`：增加统一的审计命令。

---

### Task 1: 审计状态与断点续跑

**Files:**
- Create: `scripts/lib/player-audit-state.mjs`
- Create: `scripts/player-audit.test.mjs`
- Create: `scripts/player-audit.mjs`
- Create: `data/audits/player-fact-audit.json`

**Interfaces:**
- Consumes: `loadRoster(root): Promise<Array<{ slug: string }>>` 从 `data/statbunker-roster.json` 读取名单。
- Produces: `createInitialState(slugs, generatedAt)`、`readAuditState(file)`、`writeAuditState(file, state)`、`getNextPlayers(state, limit)`、`recordAuditResult(state, slug, result)`。

- [ ] **Step 1: 为状态初始化、状态转换和断点续跑写失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createInitialState, getNextPlayers, recordAuditResult } from './lib/player-audit-state.mjs'

test('initializes every roster player and resumes only unfinished records', () => {
  const state = createInitialState(['lionel-messi', 'kaka'], '2026-08-17T00:00:00.000Z')
  assert.deepEqual(getNextPlayers(state, 20), ['lionel-messi', 'kaka'])
  const updated = recordAuditResult(state, 'lionel-messi', {
    status: '已通过', checkedAt: '2026-08-17T01:00:00.000Z', checkedCategories: ['identity'], findings: [], changedFiles: [], blockers: [],
  })
  assert.deepEqual(getNextPlayers(updated, 20), ['kaka'])
})

test('rejects completed records without checked categories', () => {
  const state = createInitialState(['kaka'], '2026-08-17T00:00:00.000Z')
  assert.throws(() => recordAuditResult(state, 'kaka', {
    status: '已通过', checkedAt: '2026-08-17T01:00:00.000Z', checkedCategories: [], findings: [], changedFiles: [], blockers: [],
  }), /checkedCategories/)
})
```

- [ ] **Step 2: 运行测试并确认模块尚不存在**

Run: `node --test scripts/player-audit.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `player-audit-state.mjs`.

- [ ] **Step 3: 实现状态 schema、不可变更新和原子写入**

```js
const terminalStatuses = new Set(['已通过', '已修改', '待复核'])
const requiredCategories = ['identity', 'career', 'honors', 'stats', 'content', 'assets']

export function createInitialState(slugs, generatedAt = new Date().toISOString()) {
  return {
    version: 1,
    generatedAt,
    players: Object.fromEntries(slugs.map((slug) => [slug, {
      status: '待审计', checkedAt: null, sourceFingerprint: null,
      checkedCategories: [], findings: [], changedFiles: [], blockers: [],
    }])),
  }
}

export function getNextPlayers(state, limit = 20) {
  return Object.entries(state.players)
    .filter(([, player]) => !terminalStatuses.has(player.status))
    .slice(0, limit)
    .map(([slug]) => slug)
}

export function recordAuditResult(state, slug, result) {
  if (!state.players[slug]) throw new Error(`Unknown player slug: ${slug}`)
  if (!terminalStatuses.has(result.status)) throw new Error(`Invalid terminal status: ${result.status}`)
  if (!result.checkedCategories?.length) throw new Error('checkedCategories must not be empty')
  return { ...state, players: { ...state.players, [slug]: structuredClone(result) } }
}
```

`writeAuditState()` 必须先写同目录临时文件，再用 `rename()` 替换目标；`readAuditState()` 必须验证 `version === 1` 和 `players` 为对象。

- [ ] **Step 4: 实现 `init` 与 `next` CLI**

```js
const [command, ...args] = process.argv.slice(2)
if (command === 'init') {
  const roster = JSON.parse(await readFile(join(root, 'data/statbunker-roster.json'), 'utf8')).players
  const state = createInitialState(roster.map(({ slug }) => slug))
  await writeAuditState(stateFile, state)
  console.log(JSON.stringify({ initialized: roster.length, stateFile }, null, 2))
} else if (command === 'next') {
  const limitArg = args.find((arg) => arg.startsWith('--limit='))
  const limit = Number.parseInt(limitArg?.split('=')[1] ?? '20', 10)
  console.log(JSON.stringify(getNextPlayers(await readAuditState(stateFile), limit), null, 2))
}
```

- [ ] **Step 5: 初始化 199 人状态并验证人数**

Run: `node scripts/player-audit.mjs init`

Expected: JSON includes `"initialized": 199` and creates `data/audits/player-fact-audit.json` with 199 player keys.

- [ ] **Step 6: 运行测试并提交**

Run: `node --test scripts/player-audit.test.mjs`

Expected: PASS.

```bash
git add scripts/lib/player-audit-state.mjs scripts/player-audit.mjs scripts/player-audit.test.mjs data/audits/player-fact-audit.json
git commit -m "feat: add resumable player audit state"
```

---

### Task 2: 跨文件事实一致性校验

**Files:**
- Create: `scripts/lib/player-audit-checks.mjs`
- Modify: `scripts/player-audit.mjs`
- Modify: `scripts/player-audit.test.mjs`

**Interfaces:**
- Consumes: `collectProjectPlayer(root, slug): Promise<ProjectPlayerSnapshot>`，汇总身份、履历、内容、统计、身价和前端派生记录。
- Produces: `checkProjectPlayer(snapshot): AuditFinding[]` 和 `checkRosterCoverage(indexes): AuditFinding[]`；finding 结构为 `{ code, severity, slug, field, message, files }`。

- [ ] **Step 1: 写身份冲突、日期倒置、荣誉计数和内容冲突的失败测试**

```js
import { checkProjectPlayer } from './lib/player-audit-checks.mjs'

test('reports deterministic cross-file contradictions', () => {
  const findings = checkProjectPlayer({
    slug: 'sample-player',
    identity: { currentClub: '巴塞罗那', retired: false },
    content: { currentClub: '皇家马德里', retired: true, intro: '现效力皇家马德里' },
    career: { spells: [{ club: 'Barcelona', start: '2025-07-01', end: '2024-07-01' }] },
    honorGroups: [{ category: '俱乐部荣誉', total: 2, items: [{ title: '联赛', count: 1, years: '2025' }] }],
    sources: { identity: 'data/player-identities.json', content: 'data/player-content-overrides.json', career: 'apps/web/src/generated/player-careers.json' },
  })
  assert.deepEqual(findings.map(({ code }) => code).sort(), [
    'career.reversed-period', 'content.current-club-conflict', 'content.retired-conflict', 'honors.total-mismatch',
  ])
})
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `node --test --test-name-pattern="deterministic cross-file" scripts/player-audit.test.mjs`

Expected: FAIL because `checkProjectPlayer` is unavailable.

- [ ] **Step 3: 实现按职责拆分的纯函数检查**

```js
export function checkProjectPlayer(snapshot) {
  return [
    ...checkIdentity(snapshot),
    ...checkCareer(snapshot),
    ...checkHonors(snapshot),
    ...checkStats(snapshot),
    ...checkContent(snapshot),
  ]
}

function checkCareer({ slug, career, sources }) {
  return (career?.spells ?? []).flatMap((spell) =>
    spell.start && spell.end && spell.start > spell.end
      ? [finding('career.reversed-period', 'error', slug, 'career.spells', `${spell.start} is after ${spell.end}`, [sources.career])]
      : [])
}

function checkHonors({ slug, honorGroups = [] }) {
  return honorGroups.flatMap((group) => {
    const sum = group.items.reduce((total, item) => total + item.count, 0)
    return sum !== group.total
      ? [finding('honors.total-mismatch', 'error', slug, 'honorGroups', `${group.total} != ${sum}`, ['apps/web/src/player-data.ts'])]
      : []
  })
}
```

同时实现 `collectProjectPlayer()`，显式读取 `player-identities.json`、`player-profiles.json`、`player-localizations.json`、`player-content-overrides.json`、`player-careers.json`、赛季统计和身价文件。缺失的球员键必须产生 `coverage.missing-player`，不能被当作空对象忽略。

- [ ] **Step 4: 为 `check` CLI 增加 `--slug` 和全量模式**

Run: `node scripts/player-audit.mjs check --slug=lionel-messi`

Expected: JSON contains `checkedPlayers: 1`, `findings`, and `summary`.

- [ ] **Step 5: 运行全量确定性检查并保存基线**

Run: `node scripts/player-audit.mjs check > data/audits/player-fact-audit-baseline.json`

Expected: command completes, reports `checkedPlayers: 199`, and every finding contains `slug`, `code`, `field`, and `files`.

- [ ] **Step 6: 运行测试并提交**

Run: `node --test scripts/player-audit.test.mjs`

Expected: PASS.

```bash
git add scripts/lib/player-audit-checks.mjs scripts/player-audit.mjs scripts/player-audit.test.mjs data/audits/player-fact-audit-baseline.json
git commit -m "feat: audit cross-file player consistency"
```

---

### Task 3: 视觉资源完整性与归属校验

**Files:**
- Create: `scripts/lib/player-audit-assets.mjs`
- Modify: `scripts/lib/player-audit-checks.mjs`
- Modify: `scripts/player-audit.test.mjs`

**Interfaces:**
- Consumes: `checkPlayerAssets(root, snapshot): Promise<AuditFinding[]>` 使用头像路径、`clubId`、`providerId`、国家队资源映射和本地文件头。
- Produces: `asset.missing-file`、`asset.empty-file`、`asset.invalid-signature`、`asset.club-id-mismatch`、`asset.missing-career-badge` 和 `asset.missing-national-mark` findings。

- [ ] **Step 1: 写缺失文件、伪 PNG 和错误俱乐部 ID 的失败测试**

```js
test('validates asset files and provider mappings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'player-audit-'))
  await mkdir(join(root, 'apps/web/public/assets/players'), { recursive: true })
  await writeFile(join(root, 'apps/web/public/assets/players/sample.png'), 'not-a-png')
  const findings = await checkPlayerAssets(root, {
    slug: 'sample', nation: 'Spain', portrait: '/assets/players/sample.png',
    career: { spells: [{ club: 'Barcelona', clubId: 131 }] },
    assets: [{ name: 'Barcelona', providerId: 'tm:418', path: '/assets/football/club-418.png' }],
  })
  assert.deepEqual(findings.map(({ code }) => code).sort(), ['asset.club-id-mismatch', 'asset.invalid-signature', 'asset.missing-career-badge', 'asset.missing-national-mark'])
})
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `node --test --test-name-pattern="asset files" scripts/player-audit.test.mjs`

Expected: FAIL because `checkPlayerAssets` is unavailable.

- [ ] **Step 3: 实现路径约束和文件签名检查**

```js
const signatures = {
  '.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  '.jpg': Buffer.from([0xff, 0xd8, 0xff]),
  '.jpeg': Buffer.from([0xff, 0xd8, 0xff]),
  '.webp': Buffer.from('RIFF'),
}

export async function validateLocalAsset(root, publicPath, slug) {
  const relative = publicPath.replace(/^\/+/, '')
  const file = resolve(root, 'apps/web/public', relative)
  const publicRoot = resolve(root, 'apps/web/public')
  if (!file.startsWith(`${publicRoot}${sep}`)) return [finding('asset.path-escape', 'error', slug, 'asset', publicPath, [])]
  const bytes = await readFile(file).catch(() => null)
  if (!bytes) return [finding('asset.missing-file', 'error', slug, 'asset', publicPath, [file])]
  if (!bytes.length) return [finding('asset.empty-file', 'error', slug, 'asset', publicPath, [file])]
  const expected = signatures[extname(file).toLowerCase()]
  return expected && !bytes.subarray(0, expected.length).equals(expected)
    ? [finding('asset.invalid-signature', 'error', slug, 'asset', publicPath, [file])]
    : []
}
```

俱乐部映射以 `tm:${clubId}` 精确匹配，禁止只按译名猜测；头像内容是否本人由 Codex 浏览器核验，自动脚本只判断路径和文件有效性。

- [ ] **Step 4: 将资源检查接入全量 `check`**

Run: `node scripts/player-audit.mjs check --category=assets`

Expected: JSON reports all 199 players and groups asset findings by code.

- [ ] **Step 5: 运行测试并提交**

Run: `node --test scripts/player-audit.test.mjs`

Expected: PASS.

```bash
git add scripts/lib/player-audit-assets.mjs scripts/lib/player-audit-checks.mjs scripts/player-audit.test.mjs
git commit -m "feat: validate player and club assets"
```

---

### Task 4: 项目级 Codex 事实审计智能体

**Files:**
- Create: `.codex/agents/player-fact-auditor.toml`
- Create: `docs/audits/player-fact-audit-runbook.md`
- Modify: `scripts/player-audit.test.mjs`

**Interfaces:**
- Consumes: 用户或主代理提供的明确 `slug` 列表；读取 `data/audits/player-fact-audit.json`，并为每个实际 slug 运行 `node scripts/player-audit.mjs check --slug=lionel-messi` 形式的命令。
- Produces: 经证据支持的源数据修改和可传给 `record` 命令的 `AuditResult` JSON。

- [ ] **Step 1: 写自定义智能体配置契约测试**

```js
test('project agent declares the required Codex fields and audit contract', async () => {
  const text = await readFile(new URL('../.codex/agents/player-fact-auditor.toml', import.meta.url), 'utf8')
  assert.match(text, /^name = "player_fact_auditor"/m)
  assert.match(text, /^description = /m)
  assert.match(text, /^developer_instructions = """/m)
  assert.match(text, /官方来源/)
  assert.match(text, /两个相互独立/)
  assert.match(text, /不得猜测/)
  assert.match(text, /data\/audits\/player-fact-audit\.json/)
})
```

- [ ] **Step 2: 运行目标测试并确认配置不存在**

Run: `node --test --test-name-pattern="agent declares" scripts/player-audit.test.mjs`

Expected: FAIL with `ENOENT` for `.codex/agents/player-fact-auditor.toml`.

- [ ] **Step 3: 创建项目级自定义智能体**

```toml
name = "player_fact_auditor"
description = "逐名联网核验 daily-star 球员身份、生涯、荣誉、统计、中文内容和视觉资源，并修正确认错误。"
developer_instructions = """
你只审计调用方明确列出的球员 slug。开始前读取 docs/audits/player-fact-audit-runbook.md、data/audits/player-fact-audit.json，并对每个实际 slug 分别运行 player-audit.mjs 的 check 命令和 --slug 参数。

按 identity、career、honors、stats、content、assets 的顺序审计。优先使用俱乐部、国家队、联赛、FIFA、洲际足联和赛事官方页面；一个官方来源可支持结论，否则必须有两个相互独立且口径一致的可靠来源。记录页面标题、URL、访问日期和它直接支持的字段。不得用搜索摘要作为证据，不得猜测或把不同统计口径合并。

明确错误直接修改 data/ 中的权威源文件，并同步修改所有受影响的中文内容。生成文件只能通过仓库脚本重建。来源冲突、证据不足或图片归属无法确认时保留原值并标记待复核。保留用户未提交改动，不做无关重构。

每名球员完成后运行确定性检查和相关生成命令，将该球员结果写入 data/audits/current-player-result.json，再运行 node scripts/player-audit.mjs record --input=data/audits/current-player-result.json 持久化状态。只有六类均已检查、证据完整且命令通过后，才可标记已通过或已修改。返回本批球员状态、修改文件、证据和阻塞项摘要。
"""
```

不固定 `model`、`model_reasoning_effort` 或沙箱设置，使其继承当前 Codex 会话配置。该格式依据官方 OpenAI 文档的项目级自定义智能体约定：`.codex/agents/*.toml` 必须定义 `name`、`description`、`developer_instructions`。

- [ ] **Step 4: 编写运行手册中的单球员结果格式**

```json
{
  "slug": "schema-fixture-player",
  "status": "已修改",
  "checkedAt": "2026-08-17T12:00:00.000Z",
  "sourceFingerprint": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "checkedCategories": ["identity", "career", "honors", "stats", "content", "assets"],
  "findings": [{
    "field": "identity.currentClub",
    "oldValue": "甲俱乐部",
    "newValue": "乙俱乐部",
    "reason": "这是运行手册中的 schema 测试夹具，实际审计必须替换为来源直接支持的理由",
    "confidence": "high",
    "evidence": [{ "title": "Schema fixture source", "url": "https://example.com/schema-fixture", "accessedAt": "2026-08-17" }]
  }],
  "changedFiles": ["data/schema-fixture.json"],
  "blockers": []
}
```

手册还必须列出每类字段对应的项目文件、推荐生成命令、禁止直接编辑的生成文件，以及图片浏览器核验清单。

- [ ] **Step 5: 运行测试并提交**

Run: `node --test scripts/player-audit.test.mjs`

Expected: PASS.

```bash
git add .codex/agents/player-fact-auditor.toml docs/audits/player-fact-audit-runbook.md scripts/player-audit.test.mjs
git commit -m "feat: add Codex player fact auditor"
```

---

### Task 5: 审计结果写入与报告生成

**Files:**
- Modify: `scripts/lib/player-audit-state.mjs`
- Modify: `scripts/player-audit.mjs`
- Modify: `scripts/player-audit.test.mjs`
- Create: `docs/audits/player-fact-audit-report.md`

**Interfaces:**
- Consumes: `record --input=data/audits/current-player-result.json` 接受 Task 4 定义的单球员或数组结果。
- Produces: 更新后的 `data/audits/player-fact-audit.json`；`report` 生成 Markdown 并输出 `{ totals, unresolved, reportFile }`。

- [ ] **Step 1: 写证据门槛、源文件指纹和报告汇总失败测试**

```js
test('rejects unsupported changes and summarizes every player', () => {
  const changedWithoutEvidence = {
    status: '已修改', checkedAt: '2026-08-17T12:00:00.000Z', sourceFingerprint: 'sha256:abc',
    checkedCategories: ['identity', 'career', 'honors', 'stats', 'content', 'assets'],
    findings: [{ field: 'currentClub', oldValue: 'A', newValue: 'B', reason: 'changed', confidence: 'high', evidence: [] }],
    changedFiles: ['data/player-identities.json'], blockers: [],
  }
  assert.throws(() => validateAuditResult(changedWithoutEvidence), /evidence/)
  const report = renderAuditReport(createInitialState(['a', 'b'], '2026-08-17T00:00:00.000Z'))
  assert.match(report, /待审计：2/)
})
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `node --test --test-name-pattern="unsupported changes" scripts/player-audit.test.mjs`

Expected: FAIL because validation and report functions are unavailable.

- [ ] **Step 3: 实现结果验证与 SHA-256 源文件指纹**

```js
export function validateAuditResult(result) {
  const categories = new Set(result.checkedCategories ?? [])
  for (const category of requiredCategories) {
    if (!categories.has(category)) throw new Error(`Missing checked category: ${category}`)
  }
  if (result.status === '已修改') {
    for (const item of result.findings ?? []) {
      if (item.oldValue !== item.newValue && !item.evidence?.length) throw new Error(`Missing evidence for ${item.field}`)
    }
  }
  if (result.status === '待复核' && !result.blockers?.length) throw new Error('待复核 requires blockers')
  return result
}

export async function fingerprintFiles(root, files) {
  const hash = createHash('sha256')
  for (const file of [...files].sort()) hash.update(file).update(await readFile(join(root, file)))
  return `sha256:${hash.digest('hex')}`
}
```

- [ ] **Step 4: 实现 `record` 和 `report` CLI**

Run: `node scripts/player-audit.mjs report`

Expected: creates `docs/audits/player-fact-audit-report.md`; totals add up to 199 and unresolved lists every `待复核` player.

- [ ] **Step 5: 运行测试并提交**

Run: `node --test scripts/player-audit.test.mjs`

Expected: PASS.

```bash
git add scripts/lib/player-audit-state.mjs scripts/player-audit.mjs scripts/player-audit.test.mjs docs/audits/player-fact-audit-report.md
git commit -m "feat: record and report player audits"
```

---

### Task 6: 统一审计命令与生成漂移门槛

**Files:**
- Modify: `package.json`
- Modify: `scripts/lib/player-audit-checks.mjs`
- Modify: `scripts/player-audit.test.mjs`

**Interfaces:**
- Consumes: 现有 `audit:player-identities`、`audit:content`、`import:player-content`、`sync:careers` 和 `build` 命令。
- Produces: `pnpm audit:players`、`pnpm audit:players:report` 和 `generation.drift` findings。

- [ ] **Step 1: 写 package script 和生成漂移失败测试**

```js
test('detects generated copies that differ from canonical data', async () => {
  const findings = checkGeneratedPair({
    slug: '*', canonicalFile: 'data/player-content-overrides.json', generatedFile: 'apps/web/src/generated/player-content-overrides.json',
    canonical: '{"players":{"a":1}}\n', generated: '{"players":{"a":2}}\n',
  })
  assert.equal(findings[0].code, 'generation.drift')
})
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `node --test --test-name-pattern="generated copies" scripts/player-audit.test.mjs`

Expected: FAIL because `checkGeneratedPair` is unavailable.

- [ ] **Step 3: 实现规范化 JSON 对比并接入全量检查**

```js
export function checkGeneratedPair({ slug, canonicalFile, generatedFile, canonical, generated }) {
  const normalize = (text) => JSON.stringify(JSON.parse(text))
  return normalize(canonical) === normalize(generated) ? [] : [finding(
    'generation.drift', 'error', slug, 'generated', `${generatedFile} differs from ${canonicalFile}`, [canonicalFile, generatedFile],
  )]
}
```

- [ ] **Step 4: 增加 package scripts**

```json
{
  "audit:players": "node scripts/player-audit.mjs check",
  "audit:players:report": "node scripts/player-audit.mjs report",
  "test:player-audit": "node --test scripts/player-audit.test.mjs"
}
```

- [ ] **Step 5: 运行基础设施验收并提交**

Run: `pnpm test:player-audit`

Expected: PASS.

Run: `pnpm audit:players`

Expected: checks 199 players and exits nonzero only when the JSON output contains one or more `error` findings.

```bash
git add package.json scripts/lib/player-audit-checks.mjs scripts/player-audit.test.mjs
git commit -m "feat: add player audit quality gate"
```

---

### Task 7: 代表性试审与工作流校准

**Files:**
- Modify: `data/audits/player-fact-audit.json`
- Modify: authoritative `data/*` files only when evidence confirms an error
- Regenerate: related `apps/web/src/generated/*`, `data/player-content.csv`, and `data/daily-star.sqlite`
- Modify: `docs/audits/player-fact-audit-report.md`

**Interfaces:**
- Consumes: custom agent `player_fact_auditor` with slugs `lionel-messi`、`gianluigi-buffon`、`luka-modric`、`lamine-yamal`、`yan-diomande`。
- Produces: five terminal audit records covering active/retired, goalkeeper/outfield, legend/young player, honors/career/stats/assets.

- [ ] **Step 1: 记录试审前基线**

Run: `node scripts/player-audit.mjs check --slug=lionel-messi --slug=gianluigi-buffon --slug=luka-modric --slug=lamine-yamal --slug=yan-diomande > data/audits/pilot-baseline.json`

Expected: reports exactly five players and does not modify source data.

- [ ] **Step 2: 调用 `player_fact_auditor` 审计五名球员**

Prompt:

```text
使用项目级 player_fact_auditor 智能体审计以下 slug：lionel-messi、gianluigi-buffon、luka-modric、lamine-yamal、yan-diomande。逐人完成六类检查，明确错误直接修正源数据，证据不足项标记待复核；每人完成后写入审计状态。保留当前工作区已有改动。
```

Expected: all five records leave `待审计`; every modification includes evidence and every `待复核` item includes blockers.

- [ ] **Step 3: 运行生成、检查和构建链路**

Run: `pnpm import:player-content && pnpm audit:player-identities && pnpm audit:content && pnpm audit:players && pnpm build`

Expected: all commands PASS. If `audit:players` exposes a factual conflict, return that player to the agent instead of suppressing the finding.

- [ ] **Step 4: 生成报告并人工审阅试审质量**

Run: `node scripts/player-audit.mjs report`

Expected: report totals equal 199; the five pilot players contain all checked categories, source URLs, accessed dates and affected files.

- [ ] **Step 5: 提交试审结果**

```bash
git add data apps/web/src/generated docs/audits data/daily-star.sqlite
git commit -m "data: audit representative player records"
```

提交前用 `git diff --name-only` 排除与这五名球员及其生成产物无关的用户改动；只暂存本任务实际修改。

---

### Task 8: 全量 199 人事实与资源审计

**Files:**
- Modify: `data/audits/player-fact-audit.json`
- Modify: confirmed erroneous authoritative `data/*` records
- Regenerate: affected `apps/web/src/generated/*`, `data/player-content.csv`, and `data/daily-star.sqlite`
- Modify: `docs/audits/player-fact-audit-report.md`

**Interfaces:**
- Consumes: `node scripts/player-audit.mjs next --limit=10` 返回下一批未完成 slugs。
- Produces: 199 个 terminal audit records；每批最多 10 人，逐批验证和提交，避免事实研究和代码改动堆积。

- [ ] **Step 1: 获取下一批明确名单**

Run: `node scripts/player-audit.mjs next --limit=10 > data/audits/current-batch.json`

Expected: `data/audits/current-batch.json` contains a JSON array of zero to ten slugs, preserving roster order and excluding completed pilot players. This transient file is not committed.

- [ ] **Step 2: 用自定义智能体审计该批明确名单**

Prompt:

```text
使用项目级 player_fact_auditor 智能体审计 data/audits/current-batch.json 中的明确 slug。逐人联网核验 identity、career、honors、stats、content、assets；明确错误修正权威源数据并重建下游文件，证据不足项标记待复核。每完成一人立即写入 data/audits/player-fact-audit.json。不要处理名单外球员，不要覆盖用户已有改动。
```

Expected: every listed slug becomes `已通过`、`已修改` or `待复核`; no other player's status changes.

- [ ] **Step 3: 验证本批并生成报告**

Run: `pnpm test:player-audit && pnpm audit:player-identities && pnpm audit:content && pnpm audit:players && node scripts/player-audit.mjs report`

Expected: tests PASS; deterministic errors introduced or left unresolved by this batch are fixed or represented as explicit blockers.

- [ ] **Step 4: 提交本批最小变更**

```bash
git add data/audits docs/audits
git add -p data apps/web/src/generated
git commit -m "data: audit next player batch"
```

`git add -p` 只选择本批确认的修正和必要派生变化，不暂存先前存在的无关改动。

- [ ] **Step 5: 重复 Steps 1-4 直到没有待审计球员**

Run after each batch: `node scripts/player-audit.mjs next --limit=10 > data/audits/current-batch.json`

Expected terminal output: `[]`. 空数组是停止条件；非空数组必须继续同一批次循环。

- [ ] **Step 6: 验证全量状态覆盖**

Run: `node -e "const s=require('./data/audits/player-fact-audit.json'); const e=Object.entries(s.players); console.log(JSON.stringify({total:e.length,pending:e.filter(([,p])=>p.status==='待审计').length,statuses:Object.groupBy(e,([,p])=>p.status)},null,2))"`

Expected: `total` is 199 and `pending` is 0.

---

### Task 9: 全项目终检与浏览器视觉抽查

**Files:**
- Modify: `docs/audits/player-fact-audit-report.md`
- Modify: `data/audits/player-fact-audit.json` only for issues discovered during final QA
- Modify/Regenerate: source and generated files only when final QA confirms an issue

**Interfaces:**
- Consumes: 199 个 terminal audit records and a clean deterministic audit.
- Produces: final build, final report, representative browser evidence, and an explicit unresolved list.

- [ ] **Step 1: 重建全部支持的下游数据**

Run: `pnpm import:player-content && pnpm sync:careers && pnpm sync:football-assets && pnpm sync:national-team-assets`

Expected: commands complete without corrupting manually curated source data; generated files have current timestamps and valid JSON.

- [ ] **Step 2: 运行全部自动验收**

Run: `pnpm test:player-audit && pnpm audit:player-identities && pnpm audit:content && pnpm audit:players && pnpm build`

Expected: PASS with 199 audited players and no unacknowledged deterministic errors or generation drift.

- [ ] **Step 3: 启动生产预览并抽查代表性球员**

Run: `pnpm preview -- --host 127.0.0.1`

Expected: Vite prints a reachable local URL. Use browser tooling at desktop and mobile widths to inspect at least：梅西、布冯、莫德里奇、亚马尔、扬·迪奥曼德、德赫亚、贝尔、多纳鲁马。For each, verify portrait identity, club badges, national mark, honors, career order, stats labels and clues.

- [ ] **Step 4: 修正终检发现并重新跑完整验收**

Run: `pnpm test:player-audit && pnpm audit:player-identities && pnpm audit:content && pnpm audit:players && pnpm build`

Expected: PASS after every final-QA correction; corresponding audit records include the added finding and evidence.

- [ ] **Step 5: 生成最终报告并提交**

Run: `node scripts/player-audit.mjs report`

Expected: totals equal 199, pending is 0, and every unresolved item is attached to a `待复核` player with blockers.

```bash
git add data/audits docs/audits data apps/web/src/generated
git commit -m "data: complete full player fact audit"
```

提交前确认 `git diff --cached --name-only` 只包含审计修正、审计状态、报告和必要派生产物。

---

## Plan Self-Review Results

- Spec coverage: identity、career、honors、stats、content、assets、生成层、断点续跑、证据、错误处理、报告、构建与浏览器验收均有对应任务。
- Scope boundary: Task 1-6 交付可独立测试的审计基础设施；Task 7 校准；Task 8 完成 199 人审计；Task 9 完成全项目终检。
- Type consistency: 所有任务统一使用 `AuditFinding { code, severity, slug, field, message, files }` 和 Task 4 定义的 `AuditResult`。
- Official Codex convention: 项目级自定义智能体使用 `.codex/agents/*.toml`，包含 `name`、`description`、`developer_instructions`，依据 [OpenAI Subagents documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)。
