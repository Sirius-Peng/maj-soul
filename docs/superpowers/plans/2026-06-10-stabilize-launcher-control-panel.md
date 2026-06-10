# Launcher Control Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a graphical launcher window as the default app entry, route Majsoul startup through a testable lifecycle controller, and fix repeated start/stop/restart stability problems with a shared validated config snapshot.

**Architecture:** Introduce a `launcher` UI layer that talks to main process IPC, plus a small lifecycle controller that owns persisted config, runtime status, and one active session at a time. Refactor the Electron entrypoint to show the launcher first and delegate Majsoul/overlay/recorder/advice creation through injected factories so the lifecycle stays unit-testable.

**Tech Stack:** Electron, Node.js, `node:test`, existing config store and overlay/recorder/advice modules

---

### Task 1: Add failing tests for launcher controller lifecycle

**Files:**
- Create: `test/launcherController.test.js`
- Modify: `src/launcher/launcherController.js`

- [ ] **Step 1: Write the failing test**

```js
test('LauncherController: startSession reuses one running session and forwards one frozen snapshot', async () => {
  const seen = [];
  const controller = createLauncherController({
    userDataDir: '/tmp/user',
    loadConfig: async () => ({ majsoulUrl: 'https://game.maj-soul.com/1/', advice: { enabled: true, apiKey: 'k', baseUrl: 'https://api.deepseek.com', model: 'm', timeoutMs: 1000, strategy: 'balanced' } }),
    saveConfig: async (value) => value,
    createRuntimeConfigSnapshot: ({ persistedConfig }) => Object.freeze(persistedConfig),
    createMainWindow: async ({ configSnapshot }) => {
      seen.push(configSnapshot);
      return fakeWindow();
    },
    createOverlay: ({ configSnapshot }) => {
      seen.push(configSnapshot);
      return fakeOverlay();
    },
    createAdviceRuntime: ({ configSnapshot }) => {
      seen.push(configSnapshot);
      return { warning: null, services: { coordinator: {} } };
    },
    startSessionRecorder: async ({ configSnapshot }) => {
      seen.push(configSnapshot);
      return { stop: async () => {} };
    },
  });

  await controller.initialize();
  await controller.startSession();
  await controller.startSession();

  assert.equal(seen.length, 4);
  assert.equal(new Set(seen).size, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/launcherController.test.js`
Expected: FAIL with module not found or missing `createLauncherController`

- [ ] **Step 3: Write minimal implementation**

```js
function createLauncherController(deps) {
  let sessionPromise = null;
  let persistedConfig = null;

  return {
    async initialize() {
      persistedConfig = await deps.loadConfig();
    },
    async startSession() {
      if (sessionPromise) return sessionPromise;
      sessionPromise = (async () => {
        const configSnapshot = deps.createRuntimeConfigSnapshot({ persistedConfig });
        const win = await deps.createMainWindow({ configSnapshot });
        const overlay = deps.createOverlay({ configSnapshot });
        const adviceRuntime = deps.createAdviceRuntime({ configSnapshot });
        const recorder = await deps.startSessionRecorder({ win, configSnapshot, adviceServices: adviceRuntime.services });
        return { win, overlay, recorder };
      })();
      return sessionPromise;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/launcherController.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/launcherController.test.js src/launcher/launcherController.js
git commit -m "test: cover launcher lifecycle controller"
```

### Task 2: Add failing tests for restart, stop, and degraded advice behavior

**Files:**
- Modify: `test/launcherController.test.js`
- Modify: `src/launcher/launcherController.js`

- [ ] **Step 1: Write the failing tests**

```js
test('LauncherController: stopSession closes Majsoul window and clears session so restart creates new resources', async () => {
  let created = 0;
  const controller = createLauncherController({
    // same config helpers as Task 1
    createMainWindow: async () => {
      created += 1;
      return fakeWindow();
    },
  });

  await controller.initialize();
  await controller.startSession();
  await controller.stopSession();
  await controller.startSession();

  assert.equal(created, 2);
});

test('LauncherController: missing API key degrades advice instead of throwing', async () => {
  const controller = createLauncherController({
    // same config helpers as Task 1
    createAdviceRuntime: ({ configSnapshot }) => {
      if (configSnapshot.advice.enabled && !configSnapshot.advice.apiKey) {
        return { warning: '建议功能未完整配置', services: null };
      }
      throw new Error('should not happen');
    },
  });

  await controller.initialize();
  await controller.startSession();

  assert.match(controller.getState().status.hint, /未完整配置/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/launcherController.test.js`
Expected: FAIL on missing stop/restart/degraded behavior

- [ ] **Step 3: Write minimal implementation**

```js
async function stopSession() {
  if (!session) return;
  session.stopping = true;
  if (session.recorder) await session.recorder.stop();
  if (session.overlay && typeof session.overlay.close === 'function') session.overlay.close();
  if (session.win && !session.win.isDestroyed()) session.win.close();
  session = null;
  sessionPromise = null;
  updateStatus();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/launcherController.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/launcherController.test.js src/launcher/launcherController.js
git commit -m "feat: stabilize launcher session lifecycle"
```

### Task 3: Add failing tests for launcher window and IPC-facing state

**Files:**
- Create: `test/launcherWindow.test.js`
- Create: `src/launcher/launcherWindow.js`
- Create: `src/launcher/preload.js`
- Create: `src/launcher/index.html`
- Create: `src/launcher/index.css`
- Create: `src/launcher/index.js`

- [ ] **Step 1: Write the failing test**

```js
test('LauncherWindow: builds desktop control panel window options', () => {
  const opts = getLauncherWindowOptions('/tmp/preload.js');
  assert.equal(opts.width, 460);
  assert.equal(opts.height, 720);
  assert.equal(opts.show, false);
  assert.equal(opts.webPreferences.preload, '/tmp/preload.js');
  assert.equal(opts.webPreferences.contextIsolation, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/launcherWindow.test.js`
Expected: FAIL with module not found

- [ ] **Step 3: Write minimal implementation**

```js
function getLauncherWindowOptions(preloadPath) {
  return {
    width: 460,
    height: 720,
    show: false,
    resizable: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/launcherWindow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add test/launcherWindow.test.js src/launcher/*
git commit -m "feat: add launcher control panel window"
```

### Task 4: Refactor app entrypoint to default to launcher and wire IPC

**Files:**
- Modify: `src/main.js`
- Modify: `src/config.js`
- Modify: `src/recorder/sessionRecorder.js`
- Modify: `test/config.test.js`
- Modify: `docs/devlog.md`

- [ ] **Step 1: Write the failing tests**

```js
test('createAdviceRuntime: warns instead of enabling services when api key missing', () => {
  const runtime = createAdviceRuntime({
    configSnapshot: {
      majsoulUrl: 'https://game.maj-soul.com/1/',
      advice: { enabled: true, apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'm', timeoutMs: 1000, strategy: 'balanced' },
    },
  });

  assert.equal(runtime.services, null);
  assert.match(runtime.warning, /未完整配置/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- test/config.test.js test/launcherController.test.js test/launcherWindow.test.js`
Expected: FAIL on missing advice runtime helper and recorder snapshot path

- [ ] **Step 3: Write minimal implementation**

```js
function createAdviceRuntime({ configSnapshot, createAdviceClientImpl = createAdviceClient, createAdviceCoordinatorImpl = createAdviceCoordinator, createOverlayWindowImpl = createOverlayWindow }) {
  if (!configSnapshot.advice.enabled) {
    return { warning: '建议功能已关闭', services: null, overlay: null };
  }
  if (!configSnapshot.advice.apiKey) {
    return { warning: '建议功能未完整配置，已降级为不启用建议', services: null, overlay: null };
  }

  const overlay = createOverlayWindowImpl({ configSnapshot });
  const client = createAdviceClientImpl(configSnapshot.advice);
  const coordinator = createAdviceCoordinatorImpl({ client, onUpdate: bindOverlay(overlay) });
  return { warning: null, services: { coordinator }, overlay };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/config.test.js test/launcherController.test.js test/launcherWindow.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/config.js src/recorder/sessionRecorder.js test/config.test.js test/launcherController.test.js test/launcherWindow.test.js docs/devlog.md
git commit -m "feat: default app startup to launcher control panel"
```
