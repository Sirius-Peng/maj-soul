const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildSessionId,
  formatTimestampForSession,
  getPlatformTag,
  getSessionLayout,
} = require('../src/session/sessionPaths');

test('formatTimestampForSession: zero-padded YYYYMMDD_HHmmss_SSS', () => {
  const d = new Date(Date.UTC(2026, 5, 10, 1, 2, 3, 4));
  assert.equal(formatTimestampForSession(d), '20260610_010203_004');
});

test('getPlatformTag: maps process.platform to stable tags', () => {
  assert.equal(getPlatformTag('darwin'), 'mac');
  assert.equal(getPlatformTag('win32'), 'win');
  assert.equal(getPlatformTag('linux'), 'linux');
  assert.equal(getPlatformTag('aix'), 'unknown');
});

test('buildSessionId: timestamp + platform', () => {
  const startedAt = new Date(Date.UTC(2026, 5, 10, 1, 2, 3, 4));
  assert.equal(buildSessionId({ startedAt, platformTag: 'mac' }), '20260610_010203_004_mac');
});

test('getSessionLayout: derives frames/keyframes/meta paths', () => {
  const baseDir = path.join(os.tmpdir(), 'majsoul-review-assistant-test');
  const layout = getSessionLayout(baseDir, '20260610_010203_004_mac');

  assert.equal(layout.sessionId, '20260610_010203_004_mac');
  assert.equal(layout.sessionDir, path.join(baseDir, 'sessions', '20260610_010203_004_mac'));
  assert.equal(layout.framesDir, path.join(layout.sessionDir, 'frames'));
  assert.equal(layout.keyframesDir, path.join(layout.sessionDir, 'keyframes'));
  assert.equal(layout.metaPath, path.join(layout.sessionDir, 'session.json'));
});

