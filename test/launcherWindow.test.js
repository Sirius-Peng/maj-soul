const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { createLauncherWindow, getLauncherWindowOptions } = require('../src/launcher/launcherWindow');

function createFakeBrowserWindow() {
  const listeners = new Map();
  const sent = [];
  let shown = false;
  let destroyed = false;
  let loadedFile = null;

  return {
    webContents: {
      send(channel, payload) {
        sent.push([channel, payload]);
      },
    },
    once(event, listener) {
      listeners.set(event, listener);
    },
    emit(event) {
      const listener = listeners.get(event);
      if (listener) {
        listener();
      }
    },
    show() {
      shown = true;
    },
    loadFile(filePath) {
      loadedFile = filePath;
    },
    isDestroyed() {
      return destroyed;
    },
    destroy() {
      destroyed = true;
    },
    getSent() {
      return sent;
    },
    wasShown() {
      return shown;
    },
    getLoadedFile() {
      return loadedFile;
    },
  };
}

test('LauncherWindow: builds desktop control panel window options with hardened defaults', () => {
  const opts = getLauncherWindowOptions('/tmp/launcher-preload.js');

  assert.equal(opts.width, 460);
  assert.equal(opts.height, 760);
  assert.equal(opts.minWidth, 420);
  assert.equal(opts.minHeight, 700);
  assert.equal(opts.title, '雀魂启动器');
  assert.equal(opts.backgroundColor, '#0d1117');
  assert.equal(opts.autoHideMenuBar, true);
  assert.equal(opts.show, false);
  assert.equal(opts.webPreferences.preload, '/tmp/launcher-preload.js');
  assert.equal(opts.webPreferences.contextIsolation, true);
  assert.equal(opts.webPreferences.sandbox, true);
  assert.equal(opts.webPreferences.nodeIntegration, false);
});

test('LauncherWindow: createLauncherWindow loads launcher page, shows on ready, and sends state only while alive', () => {
  const fakeWindow = createFakeBrowserWindow();
  const createdOptions = [];

  const launcher = createLauncherWindow({
    BrowserWindowImpl: function BrowserWindowImpl(options) {
      createdOptions.push(options);
      return fakeWindow;
    },
    preloadPath: '/tmp/custom-launcher-preload.js',
    htmlPath: '/tmp/custom-launcher-index.html',
  });

  assert.equal(createdOptions.length, 1);
  assert.equal(createdOptions[0].webPreferences.preload, '/tmp/custom-launcher-preload.js');
  assert.equal(fakeWindow.getLoadedFile(), '/tmp/custom-launcher-index.html');
  assert.equal(fakeWindow.wasShown(), false);

  fakeWindow.emit('ready-to-show');
  assert.equal(fakeWindow.wasShown(), true);

  launcher.sendState({ status: { phase: 'idle' } });
  assert.deepEqual(fakeWindow.getSent(), [['launcher:state', { status: { phase: 'idle' } }]]);

  fakeWindow.destroy();
  launcher.sendState({ status: { phase: 'running' } });
  assert.deepEqual(fakeWindow.getSent(), [['launcher:state', { status: { phase: 'idle' } }]]);
});
