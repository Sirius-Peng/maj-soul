# DeepSeek 实时建议悬浮窗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在事实流驱动下自动识别我方可操作时机，调用 DeepSeek v4flash 生成主建议与 topK 候选，并通过独立透明悬浮窗实时展示。

**Architecture:** 现有 `liqi_events` 继续作为真实状态来源；新增“操作机会识别器 + DeepSeek 建议服务 + Advice Coordinator + Overlay Window”四层。建议结果写回 SQLite 并导出到 `session.json`，悬浮窗只消费统一的 view-model。

**Tech Stack:** Electron `BrowserWindow`/`ipcMain`、Node `fetch`、SQLite `node:sqlite`、现有 liqi 解析链路、原生 HTML/CSS 悬浮窗页面

---

## File Structure

**Create**
- `src/advice/deepseekPrompt.js`：长期系统提示与请求体构建
- `src/advice/deepseekClient.js`：DeepSeek API 请求、JSON 解析、超时与错误标准化
- `src/advice/opportunityDetector.js`：从 `liqi_events`/状态快照中识别操作机会并生成 `DecisionFrame`
- `src/advice/adviceCoordinator.js`：去重、取消旧请求、广播结果
- `src/overlay/overlayWindow.js`：创建透明置顶悬浮窗并提供更新接口
- `src/overlay/preload.js`：主进程与悬浮窗 renderer 的 IPC 桥
- `src/overlay/index.html`：悬浮窗 UI
- `src/overlay/index.css`：悬浮窗样式
- `src/overlay/index.js`：渲染建议 view-model
- `test/deepseekClient.test.js`
- `test/opportunityDetector.test.js`
- `test/adviceCoordinator.test.js`

**Modify**
- `src/db/schema.js`：新增 `decision_frames`、`advice_requests`、`advice_results`
- `src/db/majsoulDb.js`：新增建议相关 CRUD
- `src/db/export.js`：导出建议相关字段
- `src/recorder/sessionRecorder.js`：将 liqi event 送入 detector/coordinator
- `src/recorder/sessionRecorderCore.js`：保留 session 生命周期 hook，必要时扩展广播
- `src/main.js`：启动 overlay 窗口和 advice coordinator
- `src/config.js`：新增 DeepSeek/overlay 配置读取
- `docs/devlog.md`：持续记录实现过程
- `package.json`：如需补充 `undici` 等依赖（首版尽量用 Node 内建 `fetch`）

---

### Task 1: 建议数据持久化

**Files:**
- Modify: `src/db/schema.js`
- Modify: `src/db/majsoulDb.js`
- Test: `test/dbAdvice.test.js`

- [ ] **Step 1: 写失败测试**

Create `test/dbAdvice.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { MajsoulDb } = require('../src/db/majsoulDb');

test('SQLite: decision/advice tables roundtrip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majsoul-advice-db-'));
  const db = new MajsoulDb(path.join(dir, 'majsoul.sqlite'));

  db.upsertSession({
    sessionId: 's1',
    startedAt: '2026-06-10T00:00:00.000Z',
    platform: 'mac',
    matchType: '4P',
  });

  const frameId = db.insertDecisionFrame({
    sessionId: 's1',
    turnId: 't1',
    operationType: 'discard',
    payload: { legalActions: [{ type: 'discard', tile: '7p' }] },
  });
  const reqId = db.insertAdviceRequest({
    sessionId: 's1',
    turnId: 't1',
    provider: 'deepseek',
    model: 'deepseek-v4flash',
    requestPayload: { turnId: 't1' },
  });
  const resId = db.insertAdviceResult({
    sessionId: 's1',
    turnId: 't1',
    requestId: reqId,
    status: 'ok',
    result: {
      recommendedAction: { label: '打 7p', probability: 0.5 },
      alternatives: [],
    },
  });

  assert.equal(typeof frameId, 'number');
  assert.equal(typeof reqId, 'number');
  assert.equal(typeof resId, 'number');
  assert.equal(db.getAdviceResults('s1').length, 1);
  db.close();
});
```

- [ ] **Step 2: 运行失败测试**

```bash
npm test -- test/dbAdvice.test.js
```

Expected: FAIL，缺少建议表与 API。

- [ ] **Step 3: 实现 schema 与 API**

需要新增三张表：

```sql
CREATE TABLE IF NOT EXISTS decision_frames (
  frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS advice_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS advice_results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  request_id INTEGER REFERENCES advice_requests(request_id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  result_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- test/dbAdvice.test.js
```

- [ ] **Step 5: 提交**

```bash
git add src/db/schema.js src/db/majsoulDb.js test/dbAdvice.test.js
git commit -m "feat(db): persist decision frames and advice results"
```

---

### Task 2: DeepSeek Prompt 与客户端

**Files:**
- Create: `src/advice/deepseekPrompt.js`
- Create: `src/advice/deepseekClient.js`
- Modify: `src/config.js`
- Test: `test/deepseekClient.test.js`

- [ ] **Step 1: 写失败测试**

Create `test/deepseekClient.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdviceClient } = require('../src/advice/deepseekClient');

test('DeepSeek client: parses strict JSON payload', async () => {
  const client = createAdviceClient({
    apiKey: 'test',
    baseUrl: 'https://example.invalid',
    model: 'deepseek-v4flash',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                turnId: 't1',
                recommendedAction: { label: '打 7p', probability: 0.5, confidence: 0.7, reason: '效率', risk: '中' },
                alternatives: [],
                summary: 'test',
                modelNotes: { style: 'balanced', inputCompleteness: 'high' },
              }),
            },
          },
        ],
      }),
    }),
  });

  const result = await client.requestAdvice({ turnId: 't1', legalActions: [] });
  assert.equal(result.turnId, 't1');
  assert.equal(result.recommendedAction.label, '打 7p');
});
```

- [ ] **Step 2: 运行失败测试**

```bash
npm test -- test/deepseekClient.test.js
```

- [ ] **Step 3: 实现 prompt 与客户端**

`src/advice/deepseekPrompt.js` 需要导出：

```js
function buildSystemPrompt() {
  return [
    '你是雀魂实时操作建议助手。',
    '只能在 legalActions 中选择动作。',
    '输出必须是 JSON。',
    'probability 表示相对推荐权重，不是严格胜率。',
    '如果信息不足，降低 confidence 并说明。',
  ].join('\n');
}

function buildUserPayload(frame, strategy) {
  return {
    turnId: frame.turnId,
    operationType: frame.operationType,
    strategyProfile: strategy,
    legalActions: frame.legalActions,
    gameSnapshot: frame.gameSnapshot,
    recentEvents: frame.recentEvents,
    uiEvidence: frame.uiEvidence,
  };
}
```

`src/advice/deepseekClient.js` 需要：

```js
function createAdviceClient({ apiKey, baseUrl, model, timeoutMs = 6000, fetchImpl = fetch }) {
  // 返回 { requestAdvice(frame) {} }
}
```

- [ ] **Step 4: 配置读取**

在 `src/config.js` 增加：

```js
function getAdviceConfig() {
  return {
    enabled: String(process.env.MAJSOUL_ADVICE_ENABLED ?? '1') === '1',
    apiKey: String(process.env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: String(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').trim(),
    model: String(process.env.DEEPSEEK_MODEL ?? 'deepseek-v4flash').trim(),
    timeoutMs: Number(process.env.MAJSOUL_ADVICE_TIMEOUT_MS ?? 6000),
    strategy: String(process.env.MAJSOUL_ADVICE_STRATEGY ?? 'balanced').trim(),
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test -- test/deepseekClient.test.js
```

- [ ] **Step 6: 提交**

```bash
git add src/advice/deepseekPrompt.js src/advice/deepseekClient.js src/config.js test/deepseekClient.test.js
git commit -m "feat(advice): add DeepSeek prompt builder and API client"
```

---

### Task 3: 操作机会识别器

**Files:**
- Create: `src/advice/opportunityDetector.js`
- Test: `test/opportunityDetector.test.js`

- [ ] **Step 1: 写失败测试**

Create `test/opportunityDetector.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOpportunityDetector } = require('../src/advice/opportunityDetector');

test('OpportunityDetector: emits turn for action event', () => {
  const detector = createOpportunityDetector({ seat: 0 });
  const frame = detector.consumeEvent({
    sessionId: 's1',
    capturedAt: '2026-06-10T00:00:00.000Z',
    method: '.lq.ActionPrototype',
    actionName: 'ActionDealTile',
    data: {
      seat: 0,
      operation: {
        type: 'discard',
        combinations: ['7p', '3s'],
      },
    },
  });

  assert.ok(frame);
  assert.equal(frame.operationType, 'discard');
  assert.equal(frame.legalActions.length, 2);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
npm test -- test/opportunityDetector.test.js
```

- [ ] **Step 3: 实现 detector**

首版只做最小可用规则：

- 当 `ActionDealTile` 或 `ActionDiscardTile` 的 payload 中存在 `operation`
- 且 `seat === mySeat`
- 提取 `operation.type` 与 `combinations`
- 构造 `turnId = ${sessionId}:${capturedAt}:${actionName}`

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- test/opportunityDetector.test.js
```

- [ ] **Step 5: 提交**

```bash
git add src/advice/opportunityDetector.js test/opportunityDetector.test.js
git commit -m "feat(advice): detect playable opportunities from liqi events"
```

---

### Task 4: Advice Coordinator

**Files:**
- Create: `src/advice/adviceCoordinator.js`
- Test: `test/adviceCoordinator.test.js`

- [ ] **Step 1: 写失败测试**

Create `test/adviceCoordinator.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdviceCoordinator } = require('../src/advice/adviceCoordinator');

test('AdviceCoordinator: deduplicates same turnId', async () => {
  let calls = 0;
  const coordinator = createAdviceCoordinator({
    client: {
      requestAdvice: async (frame) => {
        calls += 1;
        return {
          turnId: frame.turnId,
          recommendedAction: { label: '打 7p', probability: 0.5, confidence: 0.8, reason: '效率', risk: '中' },
          alternatives: [],
          summary: 'ok',
          modelNotes: {},
        };
      },
    },
    onUpdate: () => {},
  });

  await coordinator.handleDecisionFrame({ turnId: 't1', legalActions: [] });
  await coordinator.handleDecisionFrame({ turnId: 't1', legalActions: [] });
  assert.equal(calls, 1);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
npm test -- test/adviceCoordinator.test.js
```

- [ ] **Step 3: 实现 coordinator**

需要能力：

- 同一 `turnId` 只请求一次
- 新 `turnId` 到来时更新状态为 `loading`
- 返回成功后广播 `ready`
- 失败则广播 `error`

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- test/adviceCoordinator.test.js
```

- [ ] **Step 5: 提交**

```bash
git add src/advice/adviceCoordinator.js test/adviceCoordinator.test.js
git commit -m "feat(advice): add coordinator for dedupe and state transitions"
```

---

### Task 5: 悬浮窗

**Files:**
- Create: `src/overlay/overlayWindow.js`
- Create: `src/overlay/preload.js`
- Create: `src/overlay/index.html`
- Create: `src/overlay/index.css`
- Create: `src/overlay/index.js`
- Modify: `src/main.js`

- [ ] **Step 1: 创建 overlay 窗口工厂**

`src/overlay/overlayWindow.js`：

```js
const path = require('node:path');
const { BrowserWindow } = require('electron');

function createOverlayWindow() {
  const win = new BrowserWindow({
    width: 340,
    height: 260,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });
  return win;
}

module.exports = { createOverlayWindow };
```

- [ ] **Step 2: 创建静态 UI**

页面需要能展示：

- 标题
- 状态
- 主建议
- 备选 top3
- 底部标签

- [ ] **Step 3: 在 `src/main.js` 接入 overlay**

主进程创建主窗口后同时创建 overlay；先隐藏，收到建议状态时显示/更新。

- [ ] **Step 4: 手工冒烟**

运行：

```bash
npm run smoke
```

然后本地启动：

```bash
npm run dev
```

Expected: overlay window 可创建且不阻塞主窗口。

- [ ] **Step 5: 提交**

```bash
git add src/overlay src/main.js
git commit -m "feat(overlay): add transparent advice overlay window"
```

---

### Task 6: 串联录制事件、建议请求与导出

**Files:**
- Modify: `src/recorder/sessionRecorder.js`
- Modify: `src/db/export.js`
- Modify: `test/dbExport.test.js`
- Modify: `docs/devlog.md`

- [ ] **Step 1: 串联 detector 与 coordinator**

在 `sessionRecorder.js` 中：

- 创建 `OpportunityDetector`
- 在 `CdpWebSocketTap` 成功解析 `liqi` 后，把事件同时送给 detector
- detector 产出 `DecisionFrame` 后：
  - 写入 `decision_frames`
  - 调用 coordinator

- [ ] **Step 2: 导出建议字段**

在 `export.js` 中为 `session.json` 新增：

- `decisionFrames`
- `adviceResults`

- [ ] **Step 3: 扩展测试**

在 `test/dbExport.test.js` 中加入建议导出断言：

```js
assert.ok(Array.isArray(doc.adviceResults));
```

- [ ] **Step 4: 跑全量测试**

```bash
npm test
```

- [ ] **Step 5: 更新 devlog 并提交**

```bash
git add src/recorder/sessionRecorder.js src/db/export.js test/dbExport.test.js docs/devlog.md
git commit -m "feat(advice): wire opportunities to DeepSeek and export results"
```

---

### Task 7: 最终验证

**Files:**
- Modify: `README.md`
- Modify: `docs/devlog.md`

- [ ] **Step 1: 记录配置方法**

在 `README.md` 添加：

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `MAJSOUL_ADVICE_ENABLED`
- `MAJSOUL_ADVICE_TIMEOUT_MS`
- `MAJSOUL_ADVICE_STRATEGY`

- [ ] **Step 2: 执行最终验证**

```bash
npm test
npm run smoke
```

Expected:

- `npm test` 全通过
- `npm run smoke` 成功退出

- [ ] **Step 3: 提交**

```bash
git add README.md docs/devlog.md
git commit -m "docs: document DeepSeek advice overlay configuration"
```

---

## Plan Self-Review

- **Spec coverage:** 操作机会识别、长期 prompt、DeepSeek 调用、Coordinator、悬浮窗、持久化、导出、配置与测试都映射到了独立任务。
- **Placeholder scan:** 无 `TBD/TODO/implement later` 等占位描述。
- **Type consistency:** 文档内统一使用 `DecisionFrame`、`AdviceResult`、`legalActions`、`turnId`、`adviceResults` 等命名。

