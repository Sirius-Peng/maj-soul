const assert = require('node:assert/strict');
const test = require('node:test');

const { GameLifecycleDetector } = require('../src/session/lifecycleDetector');

test('GameLifecycleDetector: emits start/end on inMatch transitions', () => {
  const d = new GameLifecycleDetector();

  assert.deepEqual(d.update({ inMatch: false }), []);

  assert.deepEqual(d.update({ inMatch: true }), [{ type: 'match_started' }]);
  assert.deepEqual(d.update({ inMatch: true }), []);

  assert.deepEqual(d.update({ inMatch: false }), [{ type: 'match_ended' }]);
  assert.deepEqual(d.update({ inMatch: false }), []);
});

