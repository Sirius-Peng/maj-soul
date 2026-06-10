const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { MajsoulDb } = require('../src/db/majsoulDb');

test('SQLite: listSessionsByTime: returns sessions in [start,end] ordered by startedAt', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-db-range-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');

  const db = new MajsoulDb(dbPath);
  try {
    db.upsertSession({
      sessionId: 's1',
      startedAt: '2026-06-10T00:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });
    db.upsertSession({
      sessionId: 's2',
      startedAt: '2026-06-10T01:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });
    db.upsertSession({
      sessionId: 's3',
      startedAt: '2026-06-10T02:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });

    const sessions = db.listSessionsByTime('2026-06-10T00:30:00.000Z', '2026-06-10T02:00:00.000Z');
    assert.deepEqual(
      sessions.map((s) => s.sessionId),
      ['s2', 's3'],
    );
    assert.equal(sessions[0].startedAt, '2026-06-10T01:00:00.000Z');
    assert.equal(sessions[1].startedAt, '2026-06-10T02:00:00.000Z');
  } finally {
    db.close();
  }
});

test('SQLite: listKeyframesByTime: returns keyframes in [start,end] ordered by capturedAt', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-db-range-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');

  const db = new MajsoulDb(dbPath);
  try {
    db.upsertSession({
      sessionId: 's1',
      startedAt: '2026-06-10T00:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });
    db.upsertSession({
      sessionId: 's2',
      startedAt: '2026-06-10T01:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });
    db.upsertSession({
      sessionId: 's3',
      startedAt: '2026-06-10T02:00:00.000Z',
      endedAt: null,
      platform: 'mac',
      matchType: 'unknown',
    });

    db.insertKeyframe({
      sessionId: 's1',
      keyframeIndex: 0,
      capturedAt: '2026-06-10T00:10:00.000Z',
      fileRelpath: 'keyframes/0.png',
    });
    db.insertKeyframe({
      sessionId: 's2',
      keyframeIndex: 0,
      capturedAt: '2026-06-10T01:10:00.000Z',
      fileRelpath: 'keyframes/0.png',
      snapshot: { x: 1 },
    });
    db.insertKeyframe({
      sessionId: 's3',
      keyframeIndex: 0,
      capturedAt: '2026-06-10T02:00:00.000Z',
      fileRelpath: 'keyframes/0.png',
    });
    db.insertKeyframe({
      sessionId: 's3',
      keyframeIndex: 1,
      capturedAt: '2026-06-10T02:10:00.000Z',
      fileRelpath: 'keyframes/1.png',
    });

    const keyframes = db.listKeyframesByTime('2026-06-10T01:00:00.000Z', '2026-06-10T02:00:00.000Z');
    assert.deepEqual(
      keyframes.map((k) => `${k.sessionId}:${k.keyframeIndex}:${k.capturedAt}`),
      ['s2:0:2026-06-10T01:10:00.000Z', 's3:0:2026-06-10T02:00:00.000Z'],
    );
    assert.deepEqual(keyframes[0].snapshot, { x: 1 });
  } finally {
    db.close();
  }
});
