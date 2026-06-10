const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { MajsoulDb } = require('../src/db/majsoulDb');

test('SQLite: insertWsFrame/insertLiqiEvent/getLiqiEvents: roundtrip', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'majsoul-db-events-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');
  const db = new MajsoulDb(dbPath);

  db.upsertSession({
    sessionId: 'S1',
    startedAt: '2026-06-10T00:00:00.000Z',
    endedAt: null,
    platform: 'mac',
    majsoulUrl: null,
    window: { width: 1280, height: 720 },
    matchType: 'unknown',
    lastErrorAt: null,
  });

  const frameId = db.insertWsFrame({
    sessionId: 'S1',
    capturedAt: '2026-06-10T00:00:01.000Z',
    direction: 'recv',
    url: 'wss://example',
    opcode: 2,
    payloadBase64: Buffer.from('abc').toString('base64'),
  });
  assert.equal(typeof frameId, 'number');

  const eventId = db.insertLiqiEvent({
    sessionId: 'S1',
    capturedAt: '2026-06-10T00:00:01.000Z',
    frameId,
    method: '.lq.ActionPrototype',
    msgType: 'notify',
    step: 1,
    actionName: 'ActionMJStart',
    data: { ok: true },
  });
  assert.equal(typeof eventId, 'number');

  const events = db.getLiqiEvents('S1');
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, eventId);
  assert.equal(events[0].frameId, frameId);
  assert.equal(events[0].actionName, 'ActionMJStart');
  assert.deepEqual(events[0].data, { ok: true });

  db.close();
});

