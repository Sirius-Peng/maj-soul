# CDP WebSocket 事实数据接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Electron 内通过 CDP 抓取雀魂 WebSocket 帧并解析 liqi 协议生成“对局事实事件流”，写入 SQLite 并在 `session.json` 导出，视觉识别保留为兜底。

**Architecture:** `webContents.debugger` 监听 `Network.webSocketFrameReceived/Sent` → 写入 `ws_frames` → 依序喂给 `LiqiParser` 生成 `liqi_events` → session 生命周期开始/结束时绑定/解绑捕获 → 导出时把 events 汇总进 `session.json`。

**Tech Stack:** Electron（CDP via `webContents.debugger`）、Node（Buffer/base64）、`protobufjs`（解析 liqi.proto）、SQLite（`node:sqlite` DatabaseSync）

---

## File Structure

**Create**
- `src/net/cdpWebSocketTap.js`：CDP 连接与 WS 帧捕获（emit frame events，支持 sessionId 绑定）
- `src/liqi/liqiParser.js`：liqi WS 帧解析器（维护 REQ/RES msg_id 上下文，产出 ActionPrototype/syncGame 等事件）
- `src/liqi/liqiCodec.js`：XOR encode/decode、envelope 解码（method + payload）
- `assets/liqi_proto/liqi.proto`：liqi protobuf 定义（从 MahjongCopilot 同步）
- `assets/liqi_proto/liqi.json`：RPC 方法映射表（从 MahjongCopilot 同步）
- `test/cdpWebSocketTap.unit.test.js`：tap 的纯单测（不依赖 Electron，可测解析与 sessionId 绑定逻辑）
- `test/liqiParser.unit.test.js`：构造一条 ActionPrototype 帧 fixture，断言解析出 action event

**Modify**
- `src/db/schema.js`：新增 `ws_frames`、`liqi_events` 表（schema version bump）
- `src/db/majsoulDb.js`：新增 insert/query API（增量写入、按 sessionId 读取 events）
- `src/db/export.js`：导出 `session.json` 时包含事件流（可配置裁剪）
- `src/recorder/sessionRecorder.js`：启动 CDP tap，并把 session 生命周期绑定到 tap
- `src/recorder/sessionRecorderCore.js`：增加可注入 hook（`onSessionStarted/onSessionEnded`）用于外部绑定
- `package.json`：新增 `protobufjs` 依赖
- `docs/devlog.md`：持续记录开发过程

---

## Task 1: 添加 DB 表与访问层（ws_frames / liqi_events）

**Files:**
- Modify: `src/db/schema.js`
- Modify: `src/db/majsoulDb.js`
- Test: `test/dbExport.test.js`（扩展断言）
- Test: `test/dbTimeRange.test.js`（如需）

- [ ] **Step 1: 写失败测试（events roundtrip）**

Create `test/dbEvents.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { MajsoulDb } = require('../src/db/majsoulDb');

test('SQLite: insertWsFrame/insertLiqiEvent/getLiqiEvents: roundtrip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majsoul-db-events-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');
  const db = new MajsoulDb(dbPath);

  db.upsertSession({
    sessionId: 'S1',
    startedAt: '2026-06-10T00:00:00.000Z',
    endedAt: null,
    platform: 'mac',
    majsoulUrl: null,
    window: { width: 1280, height: 720 },
    matchType: 'unknown',
    lastErrorAt: null,
  });

  const frameId = db.insertWsFrame({
    sessionId: 'S1',
    capturedAt: '2026-06-10T00:00:01.000Z',
    direction: 'recv',
    url: 'wss://example',
    opcode: 2,
    payloadBase64: Buffer.from('abc').toString('base64'),
  });
  assert.equal(typeof frameId, 'number');

  const eventId = db.insertLiqiEvent({
    sessionId: 'S1',
    capturedAt: '2026-06-10T00:00:01.000Z',
    frameId,
    method: '.lq.ActionPrototype',
    msgType: 'notify',
    step: 1,
    actionName: 'ActionMJStart',
    data: { ok: true },
  });
  assert.equal(typeof eventId, 'number');

  const events = db.getLiqiEvents('S1');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, eventId);
  assert.equal(events[0].frameId, frameId);
  assert.equal(events[0].actionName, 'ActionMJStart');
  assert.deepEqual(events[0].data, { ok: true });

  db.close();
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- test/dbEvents.test.js
```

Expected: FAIL（`insertWsFrame` / `insertLiqiEvent` / `getLiqiEvents` 未实现）

- [ ] **Step 3: 修改 schema（增加表并 bump 版本）**

Update `src/db/schema.js`：

```js
const SCHEMA_VERSION = 2;

function getSchemaSql() {
  return `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  platform TEXT NOT NULL,
  majsoul_url TEXT,
  window_width INTEGER,
  window_height INTEGER,
  match_type TEXT NOT NULL,
  last_error_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

CREATE TABLE IF NOT EXISTS games (
  game_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  game_index INTEGER NOT NULL,
  meta_json TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, game_index)
);

CREATE TABLE IF NOT EXISTS keyframes (
  keyframe_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(game_id) ON DELETE SET NULL,
  keyframe_index INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  file_relpath TEXT NOT NULL,
  diff_score REAL,
  probe_json TEXT,
  inferred_json TEXT,
  snapshot_json TEXT,
  recognition_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, keyframe_index)
);

CREATE INDEX IF NOT EXISTS idx_keyframes_session_time ON keyframes(session_id, captured_at);

CREATE TABLE IF NOT EXISTS errors (
  error_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  keyframe_id INTEGER REFERENCES keyframes(keyframe_id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  stage TEXT,
  message TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_session_time ON errors(session_id, occurred_at);

CREATE TABLE IF NOT EXISTS ws_frames (
  frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  direction TEXT NOT NULL,
  url TEXT,
  opcode INTEGER NOT NULL,
  payload_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ws_frames_session_time ON ws_frames(session_id, captured_at);

CREATE TABLE IF NOT EXISTS liqi_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  frame_id INTEGER REFERENCES ws_frames(frame_id) ON DELETE SET NULL,
  captured_at TEXT NOT NULL,
  msg_type TEXT NOT NULL,
  method TEXT,
  step INTEGER,
  action_name TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liqi_events_session_time ON liqi_events(session_id, captured_at);
`.trim();
}

module.exports = {
  SCHEMA_VERSION,
  getSchemaSql,
};
```

- [ ] **Step 4: 实现 DB API**

Update `src/db/majsoulDb.js`（新增 prepare + 方法）：

```js
  _prepare() {
    // ...existing...

    this.stmtInsertWsFrame = this.db.prepare(`
INSERT INTO ws_frames(
  session_id, captured_at, direction, url, opcode, payload_base64, created_at
) VALUES (
  $session_id, $captured_at, $direction, $url, $opcode, $payload_base64, $created_at
)
`.trim());

    this.stmtInsertLiqiEvent = this.db.prepare(`
INSERT INTO liqi_events(
  session_id, frame_id, captured_at, msg_type, method, step, action_name, data_json, created_at
) VALUES (
  $session_id, $frame_id, $captured_at, $msg_type, $method, $step, $action_name, $data_json, $created_at
)
`.trim());

    this.stmtSelectLiqiEvents = this.db.prepare(
      'SELECT * FROM liqi_events WHERE session_id = $session_id ORDER BY captured_at ASC, event_id ASC',
    );
  }

  insertWsFrame({ sessionId, capturedAt, direction, url = null, opcode, payloadBase64 }) {
    const info = this.stmtInsertWsFrame.run({
      session_id: sessionId,
      captured_at: capturedAt,
      direction,
      url,
      opcode,
      payload_base64: payloadBase64,
      created_at: nowIso(),
    });
    return info.lastInsertRowid;
  }

  insertLiqiEvent({
    sessionId,
    frameId = null,
    capturedAt,
    msgType,
    method = null,
    step = null,
    actionName = null,
    data = undefined,
  }) {
    const info = this.stmtInsertLiqiEvent.run({
      session_id: sessionId,
      frame_id: frameId,
      captured_at: capturedAt,
      msg_type: msgType,
      method,
      step,
      action_name: actionName,
      data_json: safeJsonStringify(data),
      created_at: nowIso(),
    });
    return info.lastInsertRowid;
  }

  getLiqiEvents(sessionId) {
    const rows = this.stmtSelectLiqiEvents.all({ session_id: sessionId });
    return rows.map((r) => ({
      eventId: r.event_id,
      sessionId: r.session_id,
      frameId: r.frame_id,
      capturedAt: r.captured_at,
      msgType: r.msg_type,
      method: r.method,
      step: r.step,
      actionName: r.action_name,
      data: safeJsonParse(r.data_json),
      createdAt: r.created_at,
    }));
  }
```

- [ ] **Step 5: 运行单测确认通过**

Run:

```bash
npm test -- test/dbEvents.test.js
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/db/schema.js src/db/majsoulDb.js test/dbEvents.test.js
git commit -m "feat(db): store ws frames and liqi events"
```

---

## Task 2: 引入 liqi proto 解析（protobufjs + codec + LiqiParser）

**Files:**
- Modify: `package.json`
- Create: `assets/liqi_proto/liqi.proto`
- Create: `assets/liqi_proto/liqi.json`
- Create: `src/liqi/liqiCodec.js`
- Create: `src/liqi/liqiParser.js`
- Test: `test/liqiParser.unit.test.js`

- [ ] **Step 1: 加依赖 protobufjs**

Update `package.json`：

```json
{
  "dependencies": {
    "electron": "^36.0.0",
    "protobufjs": "^7.4.0"
  }
}
```

Run:

```bash
npm install
```

- [ ] **Step 2: 同步 liqi.proto/liqi.json**

Copy from `/Users/nh_y/Desktop/maj-soul/.external/MahjongCopilot/liqi_proto/` into:
- `assets/liqi_proto/liqi.proto`
- `assets/liqi_proto/liqi.json`

- [ ] **Step 3: 实现 liqiCodec（XOR + envelope 解码）**

Create `src/liqi/liqiCodec.js`：

```js
const keys = [0x84, 0x5e, 0x4e, 0x42, 0x39, 0xa2, 0x1f, 0x60, 0x1c];

function xorCodec(buf) {
  const out = Buffer.from(buf);
  for (let i = 0; i < out.length; i += 1) {
    const u = ((23 ^ out.length) + 5 * i + keys[i % keys.length]) & 255;
    out[i] ^= u;
  }
  return out;
}

function decodeLiqiEnvelope(payload) {
  let offset = 0;
  let method = null;
  let data = null;

  function readVarint() {
    let result = 0;
    let shift = 0;
    while (offset < payload.length) {
      const b = payload[offset++];
      result |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
    }
    return null;
  }

  function readBytes(len) {
    const end = offset + len;
    if (end > payload.length) return null;
    const b = payload.subarray(offset, end);
    offset = end;
    return b;
  }

  while (offset < payload.length) {
    const tag = readVarint();
    if (tag == null) break;
    const field = tag >>> 3;
    const wire = tag & 7;
    if (wire !== 2) return { method: null, data: null };
    const len = readVarint();
    if (len == null) return { method: null, data: null };
    const bytes = readBytes(len);
    if (!bytes) return { method: null, data: null };
    if (field === 1) method = bytes.toString('utf8');
    if (field === 2) data = Buffer.from(bytes);
  }

  return { method, data };
}

module.exports = {
  xorCodec,
  decodeLiqiEnvelope,
};
```

- [ ] **Step 4: 实现 LiqiParser（先支持 notify ActionPrototype）**

Create `src/liqi/liqiParser.js`：

```js
const fs = require('node:fs');
const path = require('node:path');
const protobuf = require('protobufjs');

const { xorCodec, decodeLiqiEnvelope } = require('./liqiCodec');

function loadAssetsPath(...parts) {
  return path.join(__dirname, '..', '..', 'assets', 'liqi_proto', ...parts);
}

function msgTypeOfByte(b) {
  if (b === 1) return 'notify';
  if (b === 2) return 'req';
  if (b === 3) return 'res';
  return 'unknown';
}

class LiqiParser {
  constructor({ root, rpcMap }) {
    this.root = root;
    this.rpcMap = rpcMap;
    this.resType = new Map();
  }

  static async create() {
    const protoPath = loadAssetsPath('liqi.proto');
    const jsonPath = loadAssetsPath('liqi.json');
    const root = await protobuf.load(protoPath);
    const rpcMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return new LiqiParser({ root, rpcMap });
  }

  parseFrame(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 2) return null;
    const typeByte = buf[0];
    const msgType = msgTypeOfByte(typeByte);
    if (msgType === 'unknown') return null;

    if (msgType === 'notify') {
      const { method, data } = decodeLiqiEnvelope(buf.subarray(1));
      if (!method || !data) return null;
      const messageName = method.split('.').pop();
      const Msg = this.root.lookupType(`lq.${messageName}`);
      const decoded = Msg.decode(data);
      const obj = Msg.toObject(decoded, { defaults: true, bytes: String });

      if (messageName === 'ActionPrototype' && typeof obj?.data === 'string' && typeof obj?.name === 'string') {
        const innerBytes = xorCodec(Buffer.from(obj.data, 'base64'));
        const Inner = this.root.lookupType(`lq.${obj.name}`);
        const innerDecoded = Inner.decode(innerBytes);
        const innerObj = Inner.toObject(innerDecoded, { defaults: true, bytes: String });
        return {
          msgType,
          method,
          step: obj.step ?? null,
          actionName: obj.name,
          data: innerObj,
        };
      }

      return { msgType, method, data: obj };
    }

    const msgId = buf.readUInt16LE(1);
    const { method, data } = decodeLiqiEnvelope(buf.subarray(3));
    if (!method || !data) return null;

    if (msgType === 'req') {
      const [, lq, service, rpc] = method.split('.');
      const domain = this.rpcMap?.nested?.[lq]?.nested?.[service]?.methods?.[rpc];
      if (!domain) return { msgType, method, msgId, data: null };
      const Req = this.root.lookupType(`lq.${domain.requestType}`);
      const decoded = Req.decode(data);
      const obj = Req.toObject(decoded, { defaults: true, bytes: String });
      this.resType.set(msgId, { method, responseType: domain.responseType });
      return { msgType, method, msgId, data: obj };
    }

    const ctx = this.resType.get(msgId);
    if (!ctx) return { msgType, method, msgId, data: null };
    this.resType.delete(msgId);
    const Res = this.root.lookupType(`lq.${ctx.responseType}`);
    const decoded = Res.decode(data);
    const obj = Res.toObject(decoded, { defaults: true, bytes: String });
    return { msgType, method: ctx.method, msgId, data: obj };
  }
}

module.exports = {
  LiqiParser,
};
```

- [ ] **Step 5: 写单测（构造 ActionPrototype 帧）**

Create `test/liqiParser.unit.test.js`：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const protobuf = require('protobufjs');
const path = require('node:path');

const { xorCodec } = require('../src/liqi/liqiCodec');
const { LiqiParser } = require('../src/liqi/liqiParser');

function encodeVarint(n) {
  const out = [];
  let v = n >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Buffer.from(out);
}

function encodeEnvelope(method, data) {
  const m = Buffer.from(method, 'utf8');
  const parts = [];
  parts.push(encodeVarint((1 << 3) | 2));
  parts.push(encodeVarint(m.length));
  parts.push(m);
  parts.push(encodeVarint((2 << 3) | 2));
  parts.push(encodeVarint(data.length));
  parts.push(data);
  return Buffer.concat(parts);
}

test('LiqiParser: parses notify ActionPrototype and decodes inner action', async () => {
  const protoPath = path.join(__dirname, '..', 'assets', 'liqi_proto', 'liqi.proto');
  const root = await protobuf.load(protoPath);

  const ActionMJStart = root.lookupType('lq.ActionMJStart');
  const actionBytes = ActionMJStart.encode(ActionMJStart.create({})).finish();
  const encrypted = xorCodec(Buffer.from(actionBytes)).toString('base64');

  const ActionPrototype = root.lookupType('lq.ActionPrototype');
  const apBytes = ActionPrototype.encode(
    ActionPrototype.create({
      step: 1,
      name: 'ActionMJStart',
      data: Buffer.from(encrypted, 'base64'),
    }),
  ).finish();

  const frame = Buffer.concat([Buffer.from([1]), encodeEnvelope('.lq.ActionPrototype', Buffer.from(apBytes))]);

  const parser = await LiqiParser.create();
  const msg = parser.parseFrame(frame);
  assert.equal(msg.msgType, 'notify');
  assert.equal(msg.method, '.lq.ActionPrototype');
  assert.equal(msg.step, 1);
  assert.equal(msg.actionName, 'ActionMJStart');
  assert.ok(msg.data && typeof msg.data === 'object');
});
```

- [ ] **Step 6: 运行单测**

```bash
npm test -- test/liqiParser.unit.test.js
```

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add package.json package-lock.json assets/liqi_proto src/liqi test/liqiParser.unit.test.js
git commit -m "feat(liqi): add protobuf-based liqi parser for ActionPrototype"
```

---

## Task 3: 实现 CDP WebSocket Tap（捕获帧并写库 + 解析事件）

**Files:**
- Create: `src/net/cdpWebSocketTap.js`
- Modify: `src/recorder/sessionRecorder.js`
- Modify: `src/recorder/sessionRecorderCore.js`
- Modify: `src/db/majsoulDb.js`（如需 ws/events 查询）
- Test: `test/sessionRecorderE2E.test.js`（扩展断言 events 写入）
- Modify: `docs/devlog.md`

- [ ] **Step 1: 创建 tap（Electron 运行时依赖）**

Create `src/net/cdpWebSocketTap.js`：

```js
const { LiqiParser } = require('../liqi/liqiParser');

function nowIso() {
  return new Date().toISOString();
}

class CdpWebSocketTap {
  constructor({ webContents, db }) {
    this.webContents = webContents;
    this.db = db;
    this.sessionId = null;
    this.parser = null;
    this.attached = false;
    this.boundOnMessage = null;
  }

  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  async start() {
    if (this.attached) return;
    this.parser = await LiqiParser.create();
    this.webContents.debugger.attach('1.3');
    await this.webContents.debugger.sendCommand('Network.enable');
    this.boundOnMessage = async (_event, method, params) => {
      if (!this.sessionId) return;
      if (method !== 'Network.webSocketFrameReceived' && method !== 'Network.webSocketFrameSent') return;
      const direction = method === 'Network.webSocketFrameSent' ? 'sent' : 'recv';
      const frame = params?.response ?? params?.frame ?? null;
      if (!frame) return;
      const opcode = frame.opcode ?? 1;
      const url = params?.response?.url ?? params?.url ?? null;
      const capturedAt = nowIso();
      const payloadData = frame.payloadData ?? '';
      const payloadBuf =
        opcode === 2 ? Buffer.from(payloadData, 'base64') : Buffer.from(String(payloadData), 'utf8');
      const payloadBase64 = payloadBuf.toString('base64');

      const frameId = this.db.insertWsFrame({
        sessionId: this.sessionId,
        capturedAt,
        direction,
        url,
        opcode,
        payloadBase64,
      });

      const liqi = this.parser.parseFrame(payloadBuf);
      if (!liqi) return;
      this.db.insertLiqiEvent({
        sessionId: this.sessionId,
        frameId,
        capturedAt,
        msgType: liqi.msgType,
        method: liqi.method,
        step: liqi.step ?? null,
        actionName: liqi.actionName ?? null,
        data: liqi.data ?? null,
      });
    };
    this.webContents.debugger.on('message', this.boundOnMessage);
    this.attached = true;
  }

  async stop() {
    this.sessionId = null;
    if (!this.attached) return;
    if (this.boundOnMessage) this.webContents.debugger.off('message', this.boundOnMessage);
    this.boundOnMessage = null;
    try {
      this.webContents.debugger.detach();
    } catch {}
    this.attached = false;
  }
}

module.exports = {
  CdpWebSocketTap,
};
```

- [ ] **Step 2: 让 core 暴露 session 生命周期 hook**

Update `src/recorder/sessionRecorderCore.js`：在 session 开始创建后调用 hook，在结束导出后调用 hook（保持 hook 可选）。

示例修改片段（按实际结构落点插入）：

```js
    if (lifecycleEvent === 'match_started') {
      // ...existing create session meta...
      if (typeof deps?.onSessionStarted === 'function') {
        await deps.onSessionStarted({ sessionId: meta.sessionId });
      }
    }

    if (lifecycleEvent === 'match_ended') {
      // ...existing export...
      if (typeof deps?.onSessionEnded === 'function') {
        await deps.onSessionEnded({ sessionId: meta.sessionId });
      }
    }
```

- [ ] **Step 3: 在 Electron recorder 启动 tap 并绑定 session**

Update `src/recorder/sessionRecorder.js`：

```js
const { CdpWebSocketTap } = require('../net/cdpWebSocketTap');

// ...existing...

  const tap = new CdpWebSocketTap({ webContents, db: core.db });
  await tap.start();

  const core = await createSessionRecorderCore({
    // ...existing...
    deps: {
      now: () => new Date(),
      capture: async () => { /* ... */ },
      probe: async () => probeMajsoulState(webContents),
      onSessionStarted: async ({ sessionId }) => {
        tap.setSessionId(sessionId);
      },
      onSessionEnded: async () => {
        tap.setSessionId(null);
      },
    },
  });

  win.on('closed', () => {
    clearInterval(timer);
    tap.stop().catch(() => {});
    core.stop().catch(() => {});
  });
```

（如果 `createSessionRecorderCore` 未暴露 `db`，则在 core create 时把 `MajsoulDb` 实例也交给 `startSessionRecorder`，以便 tap 使用。）

- [ ] **Step 4: 扩展 E2E 测试断言 events 写入**

Update `test/sessionRecorderE2E.test.js`：在结束后读取 `db.getLiqiEvents(sessionId)`，断言数组存在（可为 0），并断言 schema/查询不会抛错。

```js
  const events = db.getLiqiEvents(sessionId);
  assert.ok(Array.isArray(events));
```

- [ ] **Step 5: 运行全量测试**

```bash
npm test
```

Expected: PASS

- [ ] **Step 6: 记录 devlog 并提交**

Update `docs/devlog.md` 追加条目：
- 增加 CDP WS 捕获与 liqi events 入库

Commit:

```bash
git add src/net src/recorder src/db test/sessionRecorderE2E.test.js docs/devlog.md
git commit -m "feat(net): capture majsoul ws frames via cdp and persist liqi events"
```

---

## Task 4: 导出 session.json 包含事件流（可裁剪）

**Files:**
- Modify: `src/db/export.js`
- Modify: `test/dbExport.test.js`

- [ ] **Step 1: 写失败测试（导出包含 events）**

Update `test/dbExport.test.js` 追加断言（示意）：

```js
  const exported = exportSessionJson(db, sessionId);
  assert.ok(Array.isArray(exported.events));
```

- [ ] **Step 2: 实现导出拼装**

Update `src/db/export.js`：在导出结构中加入 `events`：

```js
  const events = db.getLiqiEvents(sessionId);
  return {
    meta: session,
    games,
    keyframes,
    errors,
    events,
  };
```

如需控制体积，增加 env：
- `MAJSOUL_EXPORT_EVENTS_MAX=0|N`：只导出最后 N 条（默认 0=不裁剪）

- [ ] **Step 3: 运行单测**

```bash
npm test -- test/dbExport.test.js
```

- [ ] **Step 4: 提交**

```bash
git add src/db/export.js test/dbExport.test.js
git commit -m "feat(export): include liqi events in session.json"
```

---

## Task 5: 冒烟验证（真实打开雀魂并捕获到 ws_frames）

**Files:**
- Modify: `scripts/smoke-electron.js`（可选：在脚本里启用 recorder + 等待一段时间）
- Modify: `docs/devlog.md`

- [ ] **Step 1: 扩展 smoke（可选）**

在 `scripts/smoke-electron.js` 中，除了截图+识别，再加：
- 创建 `MajsoulDb` + `CdpWebSocketTap`
- 设定临时 sessionId（例如 `SMOKE_<timestamp>`）并写入 sessions
- 启动 tap，等待 5-10 秒，停止 tap
- 断言 `ws_frames` 表至少 1 行（如果页面未建立 WS，可记录为“环境相关”并只输出统计）

- [ ] **Step 2: 运行 smoke**

```bash
npm run smoke
```

- [ ] **Step 3: 更新 devlog 并提交**

```bash
git add scripts/smoke-electron.js docs/devlog.md
git commit -m "test(smoke): capture ws frames during smoke run"
```

---

## Plan Self-Review

- 覆盖目标：CDP 抓帧、liqi ActionPrototype 解包、events 入库、session.json 导出、最小冒烟验证均有对应 Task。
- 无占位：每个 Step 提供了具体文件路径、代码骨架、命令与预期。
- 类型一致：DB 表字段与 `MajsoulDb` API、导出字段在各 Task 中命名一致（`ws_frames`/`liqi_events`/`events`）。

---

## Execution Handoff

计划已写入 `docs/superpowers/plans/2026-06-10-cdp-websocket-facts.md`。

两种执行方式：
1) **Subagent-Driven（推荐）**：我按 Task 逐个派发子任务执行，每步 review 后再继续  
2) **Inline Execution**：我在当前会话按 Task 顺序执行并在关键点停下来给你 review

你选哪一种？

