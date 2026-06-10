const test = require('node:test');
const assert = require('node:assert/strict');

const { createAdviceRuntime } = require('../src/launcher/adviceRuntime');

function buildSnapshot(overrides = {}) {
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

test('createAdviceRuntime: degrades gracefully when advice is enabled without api key', () => {
  let createClientCalls = 0;
  let createCoordinatorCalls = 0;
  let createOverlayCalls = 0;

  const runtime = createAdviceRuntime({
    configSnapshot: buildSnapshot({ advice: { apiKey: '' } }),
    createAdviceClientImpl: () => {
      createClientCalls += 1;
      return {};
    },
    createAdviceCoordinatorImpl: () => {
      createCoordinatorCalls += 1;
      return {};
    },
    createOverlayWindowImpl: () => {
      createOverlayCalls += 1;
      return {};
    },
  });

  assert.deepEqual(runtime.services, null);
  assert.equal(runtime.overlay, null);
  assert.match(runtime.warning, /未完整配置/);
  assert.equal(createClientCalls, 0);
  assert.equal(createCoordinatorCalls, 0);
  assert.equal(createOverlayCalls, 0);
});

test('createAdviceRuntime: creates overlay and coordinator when advice is fully configured', () => {
  const calls = [];
  const overlay = {
    loading: [],
    ready: [],
    errors: [],
    showLoading(payload) {
      this.loading.push(payload);
    },
    showReady(payload) {
      this.ready.push(payload);
    },
    showError(payload) {
      this.errors.push(payload);
    },
    close() {},
  };
  const client = { requestAdvice() {} };
  const coordinator = { kind: 'coordinator' };

  const runtime = createAdviceRuntime({
    configSnapshot: buildSnapshot(),
    createAdviceClientImpl: (adviceConfig) => {
      calls.push(['client', adviceConfig]);
      return client;
    },
    createAdviceCoordinatorImpl: ({ client: coordinatorClient, onUpdate }) => {
      calls.push(['coordinator', coordinatorClient]);
      onUpdate({ type: 'loading', turnId: 't-1' });
      return coordinator;
    },
    createOverlayWindowImpl: ({ configSnapshot }) => {
      calls.push(['overlay', configSnapshot]);
      return overlay;
    },
  });

  assert.equal(runtime.warning, null);
  assert.equal(runtime.overlay, overlay);
  assert.deepEqual(runtime.services, { coordinator });
  assert.equal(calls[0][0], 'overlay');
  assert.equal(calls[1][0], 'client');
  assert.equal(calls[2][0], 'coordinator');
  assert.deepEqual(overlay.loading, [{ turnId: 't-1' }]);
});
