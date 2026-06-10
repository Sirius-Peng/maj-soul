const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { readSessionMetadata, writeSessionMetadata } = require('../src/session/sessionMetadata');

test('writeSessionMetadata/readSessionMetadata: roundtrip', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'majsoul-session-meta-'));
  const metaPath = path.join(dir, 'session.json');

  const meta = {
    sessionId: '20260610_010203_004_mac',
    startedAt: '2026-06-10T01:02:03.004Z',
    platform: 'mac',
    matchType: 'unknown',
  };

  await writeSessionMetadata(metaPath, meta);
  const readBack = await readSessionMetadata(metaPath);
  assert.deepEqual(readBack, meta);
});

