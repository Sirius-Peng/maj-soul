const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { checkSessionConsistency } = require('../src/db/consistency');
const { exportKeyframesCsv, exportKeyframesCsvString, exportSessionJson } = require('../src/db/export');
const { MajsoulDb } = require('../src/db/majsoulDb');
const { readSessionDocument } = require('../src/session/sessionMetadata');

test('SQLite: exportSessionJson/exportKeyframesCsv: roundtrip basic fields', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-db-export-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');
  const sessionDir = path.join(dir, 'sessions', 's1');
  await fs.mkdir(path.join(sessionDir, 'keyframes'), { recursive: true });

  const db = new MajsoulDb(dbPath);
  try {
    const meta = {
      sessionId: 's1',
      startedAt: '2026-06-10T01:02:03.004Z',
      endedAt: '2026-06-10T01:02:10.000Z',
      platform: 'mac',
      majsoulUrl: 'https://example.invalid/',
      window: { width: 1280, height: 720 },
      matchType: '4P',
    };
    db.upsertSession(meta);

    const rel = 'keyframes/00000000_20260610T010203004Z.png';
    await fs.writeFile(path.join(sessionDir, rel), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    db.insertKeyframe({
      sessionId: meta.sessionId,
      keyframeIndex: 0,
      capturedAt: '2026-06-10T01:02:04.000Z',
      fileRelpath: rel,
      diffScore: 42,
      snapshot: { inMatch: true, playerCount: 4, matchType: meta.matchType },
    });

    db.insertError({
      sessionId: meta.sessionId,
      occurredAt: '2026-06-10T01:02:05.000Z',
      stage: 'test',
      message: 'boom',
      detail: { x: 1 },
    });

    const frameId = db.insertWsFrame({
      sessionId: meta.sessionId,
      capturedAt: '2026-06-10T01:02:06.000Z',
      direction: 'recv',
      url: 'wss://example.invalid/',
      opcode: 2,
      payloadBase64: Buffer.from([1, 2, 3]).toString('base64'),
    });
    db.insertLiqiEvent({
      sessionId: meta.sessionId,
      frameId,
      capturedAt: '2026-06-10T01:02:06.000Z',
      msgType: 'notify',
      method: '.lq.ActionPrototype',
      step: 1,
      actionName: 'ActionMJStart',
      data: { ok: true },
    });

    const sessionJsonPath = path.join(sessionDir, 'session.json');
    await exportSessionJson({ db, sessionId: meta.sessionId, outPath: sessionJsonPath });
    const doc = await readSessionDocument(sessionJsonPath);

    assert.equal(doc.schemaVersion, 2);
    assert.equal(doc.meta.sessionId, meta.sessionId);
    assert.equal(doc.keyframes.length, 1);
    assert.equal(doc.errors.length, 1);
    assert.equal(doc.events.length, 1);
    assert.equal(doc.keyframes[0].fileRelpath, rel);

    const csv = exportKeyframesCsvString({ db, sessionId: meta.sessionId });
    assert.match(csv, /sessionId,startedAt,endedAt,matchType,keyframeIndex/);

    const csvPath = path.join(sessionDir, 'keyframes.csv');
    await exportKeyframesCsv({ db, sessionId: meta.sessionId, outPath: csvPath });
    const csvOnDisk = await fs.readFile(csvPath, 'utf8');
    assert.equal(csvOnDisk, csv);
  } finally {
    db.close();
  }
});

test('SQLite: checkSessionConsistency: missing keyframe file', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-db-consistency-'));
  const dbPath = path.join(dir, 'majsoul.sqlite');
  const sessionDir = path.join(dir, 'sessions', 's1');
  await fs.mkdir(path.join(sessionDir, 'keyframes'), { recursive: true });

  const db = new MajsoulDb(dbPath);
  try {
    db.upsertSession({
      sessionId: 's1',
      startedAt: '2026-06-10T01:02:03.004Z',
      endedAt: '2026-06-10T01:02:10.000Z',
      platform: 'mac',
      matchType: 'unknown',
    });

    db.insertKeyframe({
      sessionId: 's1',
      keyframeIndex: 0,
      capturedAt: '2026-06-10T01:02:04.000Z',
      fileRelpath: 'keyframes/missing.png',
    });

    const res = await checkSessionConsistency({ db, sessionId: 's1', sessionDir });
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.type === 'missing_keyframe_file'));
  } finally {
    db.close();
  }
});
