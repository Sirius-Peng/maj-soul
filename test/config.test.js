const assert = require('node:assert/strict');
const test = require('node:test');

const { getMajsoulUrl, getMainWindowOptions } = require('../src/config');

test('getMajsoulUrl: default', () => {
  assert.equal(getMajsoulUrl(), 'https://game.maj-soul.com/1/');
});

test('getMainWindowOptions: security defaults', () => {
  const options = getMainWindowOptions();

  assert.equal(options.webPreferences.nodeIntegration, false);
  assert.equal(options.webPreferences.contextIsolation, true);
});
