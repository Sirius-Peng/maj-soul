const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { MajsoulDb } = require('../src/db/majsoulDb');

test('SQLite: decision/advice tables roundtrip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majsoul-advice-db-'));
  const db = new MajsoulDb(path.join(dir, 'majsoul.sqlite'));

  db.upsertSession({
    sessionId: 's1',
    startedAt: '2026-06-10T00:00:00.000Z',
    platform: 'mac',
    matchType: '4P',
  });

  const frameId = db.insertDecisionFrame({
    sessionId: 's1',
    turnId: 't1',
    operationType: 'discard',
    payload: { legalActions: [{ type: 'discard', tile: '7p' }] },
  });
  const reqId = db.insertAdviceRequest({
    sessionId: 's1',
    turnId: 't1',
    provider: 'deepseek',
    model: 'deepseek-v4flash',
    requestPayload: { turnId: 't1' },
  });
  const resId = db.insertAdviceResult({
    sessionId: 's1',
    turnId: 't1',
    requestId: reqId,
    status: 'ok',
    result: {
      recommendedAction: { label: '打 7p', probability: 0.5 },
      alternatives: [],
    },
  });

  assert.equal(typeof frameId, 'number');
  assert.equal(typeof reqId, 'number');
  assert.equal(typeof resId, 'number');
  assert.equal(db.getAdviceResults('s1').length, 1);
  db.close();
});

