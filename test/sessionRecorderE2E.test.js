const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { MajsoulDb } = require('../src/db/majsoulDb');
const { readSessionDocument } = require('../src/session/sessionMetadata');
const { createSessionRecorderCore } = require('../src/recorder/sessionRecorderCore');

test('SessionRecorderCore: end-to-end writes session dir, SQLite rows, and exports session.json', async () => {
  const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-recorder-e2e-'));

  let clock = Date.parse('2026-06-10T01:02:03.004Z');
  const now = () => new Date((clock += 1));

  const probeSeq = [
    { inMatch: false, playerCount: 4 },
    { inMatch: true, playerCount: 4 },
    { inMatch: true, playerCount: 4 },
    { inMatch: false, playerCount: 4 },
  ];

  const capture = async () => ({
    width: 2,
    height: 2,
    bitmap: Buffer.alloc(2 * 2 * 4),
    png: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });

  const core = await createSessionRecorderCore({
    baseDir,
    majsoulUrl: 'https://example.invalid/',
    platformTag: 'mac',
    window: { width: 1280, height: 720 },
    captureAllFrames: false,
    shouldExportCsv: false,
    deps: {
      now,
      capture,
      probe: async () => probeSeq.shift() ?? { inMatch: false, playerCount: 4 },
      keyframeDecider: () => ({ isKeyframe: true, score: 0 }),
      recognizeFrame: () => ({}),
    },
  });

  try {
    await core.tick();
    await core.tick();
    await core.tick();
    await core.tick();

    const sessionsRoot = path.join(baseDir, 'sessions');
    const entries = await fs.readdir(sessionsRoot, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    assert.equal(dirs.length, 1);

    const sessionId = dirs[0];
    const sessionDir = path.join(sessionsRoot, sessionId);

    const dbPath = path.join(baseDir, 'majsoul.sqlite');
    const db = new MajsoulDb(dbPath);
    try {
      const session = db.getSession(sessionId);
      assert.ok(session);
      assert.ok(session.endedAt);
      const keyframes = db.getKeyframes(sessionId);
      assert.ok(keyframes.length >= 1);
    } finally {
      db.close();
    }

    const keyframesDir = path.join(sessionDir, 'keyframes');
    const keyframeFiles = (await fs.readdir(keyframesDir)).filter((f) => f.toLowerCase().endsWith('.png'));
    assert.ok(keyframeFiles.length >= 1);

    const doc = await readSessionDocument(path.join(sessionDir, 'session.json'));
    assert.equal(doc.schemaVersion, 1);
    assert.equal(doc.meta.sessionId, sessionId);
    assert.ok(doc.meta.endedAt);
    assert.ok(doc.keyframes.length >= 1);
    assert.equal(doc.stats.keyframeCount, doc.keyframes.length);
  } finally {
    await core.stop();
  }
});

