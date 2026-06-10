const test = require('node:test');
const assert = require('node:assert/strict');

const { createLauncherController } = require('../src/launcher/launcherController');

function buildConfig(overrides = {}) {
  return {
    majsoulUrl: 'https://game.maj-soul.com/1/',
    advice: {
      enabled: true,
      apiKey: 'test-key',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4flash',
      timeoutMs: 6000,
      strategy: 'balanced',
      ...overrides.advice,
    },
    ...overrides,
  };
}

function createFakeWindow(label) {
  const listeners = new Map();
  let destroyed = false;
  let closeCount = 0;

  return {
    label,
    on(event, listener) {
      listeners.set(event, listener);
    },
    emit(event) {
      const listener = listeners.get(event);
      if (listener) {
        listener();
      }
    },
    close() {
      closeCount += 1;
      destroyed = true;
      this.emit('closed');
    },
    isDestroyed() {
      return destroyed;
    },
    getCloseCount() {
      return closeCount;
    },
  };
}

test('LauncherController: startSession reuses one running session and forwards one frozen snapshot', async () => {
  const snapshots = [];
  let createMainWindowCalls = 0;
  let startRecorderCalls = 0;

  const controller = createLauncherController({
    userDataDir: '/tmp/majsoul-user-data',
    loadPersistedConfig: async () => buildConfig(),
    savePersistedConfig: async (config) => config,
    createRuntimeConfigSnapshot: ({ persistedConfig }) => Object.freeze(persistedConfig),
    createAdviceRuntime: ({ configSnapshot }) => {
      snapshots.push(configSnapshot);
      return {
        warning: null,
        overlay: { close() {} },
        services: { coordinator: { kind: 'coordinator' } },
      };
    },
    createMainWindow: async ({ configSnapshot }) => {
      createMainWindowCalls += 1;
      snapshots.push(configSnapshot);
      return createFakeWindow('main-1');
    },
    startSessionRecorder: async ({ configSnapshot, adviceServices }) => {
      startRecorderCalls += 1;
      snapshots.push(configSnapshot);
      assert.deepEqual(adviceServices, { coordinator: { kind: 'coordinator' } });
      return {
        async stop() {},
      };
    },
  });

  await controller.initialize();

  const first = await controller.startSession();
  const second = await controller.startSession();

  assert.equal(first, second);
  assert.equal(createMainWindowCalls, 1);
  assert.equal(startRecorderCalls, 1);
  assert.equal(snapshots.length, 3);
  assert.equal(new Set(snapshots).size, 1);
  assert.equal(controller.getState().status.phase, 'running');
});

test('LauncherController: stopSession closes Majsoul window and clears resources so restart creates new ones', async () => {
  let nextId = 0;
  const windows = [];
  const overlays = [];
  const recorders = [];

  const controller = createLauncherController({
    userDataDir: '/tmp/majsoul-user-data',
    loadPersistedConfig: async () => buildConfig(),
    savePersistedConfig: async (config) => config,
    createRuntimeConfigSnapshot: ({ persistedConfig }) => Object.freeze({
      ...persistedConfig,
      snapshotId: `snapshot-${nextId + 1}`,
    }),
    createAdviceRuntime: () => {
      const overlay = {
        closeCalls: 0,
        close() {
          this.closeCalls += 1;
        },
      };
      overlays.push(overlay);
      return {
        warning: null,
        overlay,
        services: { coordinator: { kind: 'coordinator' } },
      };
    },
    createMainWindow: async () => {
      nextId += 1;
      const win = createFakeWindow(`main-${nextId}`);
      windows.push(win);
      return win;
    },
    startSessionRecorder: async () => {
      const recorder = {
        stopCalls: 0,
        async stop() {
          this.stopCalls += 1;
        },
      };
      recorders.push(recorder);
      return recorder;
    },
  });

  await controller.initialize();
  const first = await controller.startSession();
  await controller.stopSession();
  const second = await controller.startSession();

  assert.notEqual(first, second);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].getCloseCount(), 1);
  assert.equal(recorders[0].stopCalls, 1);
  assert.equal(overlays[0].closeCalls, 1);
  assert.equal(controller.getState().status.phase, 'running');
});

test('LauncherController: closing the main window clears stale references so a later start creates a fresh session', async () => {
  let createMainWindowCalls = 0;
  const windows = [];

  const controller = createLauncherController({
    userDataDir: '/tmp/majsoul-user-data',
    loadPersistedConfig: async () => buildConfig(),
    savePersistedConfig: async (config) => config,
    createRuntimeConfigSnapshot: ({ persistedConfig }) => Object.freeze({
      ...persistedConfig,
      snapshotId: `snapshot-${createMainWindowCalls + 1}`,
    }),
    createAdviceRuntime: () => ({
      warning: null,
      overlay: { close() {} },
      services: { coordinator: { kind: 'coordinator' } },
    }),
    createMainWindow: async () => {
      createMainWindowCalls += 1;
      const win = createFakeWindow(`main-${createMainWindowCalls}`);
      windows.push(win);
      return win;
    },
    startSessionRecorder: async () => ({
      async stop() {},
    }),
  });

  await controller.initialize();
  const first = await controller.startSession();
  windows[0].emit('closed');
  const second = await controller.startSession();

  assert.notEqual(first, second);
  assert.equal(createMainWindowCalls, 2);
  assert.equal(controller.getState().status.phase, 'running');
});

test('LauncherController: missing API key degrades advice instead of throwing and exposes warning state', async () => {
  const controller = createLauncherController({
    userDataDir: '/tmp/majsoul-user-data',
    loadPersistedConfig: async () => buildConfig({ advice: { apiKey: '' } }),
    savePersistedConfig: async (config) => config,
    createRuntimeConfigSnapshot: ({ persistedConfig }) => Object.freeze(persistedConfig),
    createAdviceRuntime: ({ configSnapshot }) => {
      assert.equal(configSnapshot.advice.apiKey, '');
      return {
        warning: '建议功能未完整配置，已降级为不启用建议',
        overlay: null,
        services: null,
      };
    },
    createMainWindow: async () => createFakeWindow('main-1'),
    startSessionRecorder: async ({ adviceServices }) => {
      assert.equal(adviceServices, null);
      return {
        async stop() {},
      };
    },
  });

  await controller.initialize();
  await controller.startSession();

  assert.match(controller.getState().status.warning, /未完整配置/);
  assert.equal(controller.getState().status.phase, 'running');
});
