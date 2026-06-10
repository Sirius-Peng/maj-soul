const test = require('node:test');
const assert = require('node:assert/strict');

const { getOverlayWindowOptions } = require('../src/overlay/overlayWindow');
const { getLauncherWindowOptions } = require('../src/launcher/launcherWindow');

test('OverlayWindow: builds transparent always-on-top options', () => {
  const opts = getOverlayWindowOptions('/tmp/preload.js');
  assert.equal(opts.transparent, true);
  assert.equal(opts.alwaysOnTop, true);
  assert.equal(opts.frame, false);
  assert.equal(opts.webPreferences.preload, '/tmp/preload.js');
  assert.equal(opts.webPreferences.sandbox, true);
  assert.equal(opts.webPreferences.nodeIntegration, false);
});

test('LauncherWindow: builds restrained desktop control panel options', () => {
  const opts = getLauncherWindowOptions('/tmp/launcher-preload.js');
  assert.equal(opts.width, 460);
  assert.equal(opts.height, 760);
  assert.equal(opts.show, false);
  assert.equal(opts.title, '雀魂启动器');
  assert.equal(opts.webPreferences.preload, '/tmp/launcher-preload.js');
  assert.equal(opts.webPreferences.contextIsolation, true);
});
