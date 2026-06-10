const assert = require('node:assert/strict');
const test = require('node:test');

const { detectMatchTypeFromProbe } = require('../src/session/matchTypeDetector');

test('detectMatchTypeFromProbe: maps playerCount to 3P/4P', () => {
  assert.equal(detectMatchTypeFromProbe({ playerCount: 3 }), '3P');
  assert.equal(detectMatchTypeFromProbe({ playerCount: 4 }), '4P');
});

test('detectMatchTypeFromProbe: unknown when missing/invalid', () => {
  assert.equal(detectMatchTypeFromProbe({}), 'unknown');
  assert.equal(detectMatchTypeFromProbe({ playerCount: 2 }), 'unknown');
  assert.equal(detectMatchTypeFromProbe({ playerCount: null }), 'unknown');
});

