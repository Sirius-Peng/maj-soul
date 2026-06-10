const test = require('node:test');
const assert = require('node:assert/strict');

const { startSessionFromLauncherWindow } = require('../src/launcher/launcherSmoke');

function createFakeWindow({ loading = false } = {}) {
  const windowListeners = new Map();
  const webContentsListeners = new Map();
  const executedScripts = [];
  let isLoading = loading;

  return {
    once(event, listener) {
      windowListeners.set(event, listener);
    },
    emitWindow(event) {
      const listener = windowListeners.get(event);
      if (listener) {
        listener();
      }
    },
    webContents: {
      isLoading() {
        return isLoading;
      },
      once(event, listener) {
        webContentsListeners.set(event, listener);
      },
      emit(event) {
        const listener = webContentsListeners.get(event);
        if (listener) {
          isLoading = false;
          listener();
        }
      },
      async executeJavaScript(script) {
        executedScripts.push(script);
        return { status: { phase: 'running' } };
      },
    },
    getExecutedScripts() {
      return executedScripts;
    },
  };
}

test('startSessionFromLauncherWindow: waits for launcher page load before invoking renderer api', async () => {
  const win = createFakeWindow({ loading: true });
  const pending = startSessionFromLauncherWindow(win);

  assert.deepEqual(win.getExecutedScripts(), []);

  win.webContents.emit('did-finish-load');
  const state = await pending;

  assert.deepEqual(win.getExecutedScripts(), ['window.launcherApi.startSession()']);
  assert.deepEqual(state, { status: { phase: 'running' } });
});

test('startSessionFromLauncherWindow: rejects if launcher window closes before load finishes', async () => {
  const win = createFakeWindow({ loading: true });
  const pending = startSessionFromLauncherWindow(win);

  win.emitWindow('closed');

  await assert.rejects(pending, /launcher window closed/i);
  assert.deepEqual(win.getExecutedScripts(), []);
});
