const fs = require('node:fs/promises');
const path = require('node:path');

function buildSessionDocument({ session, games, keyframes, errors }) {
  const meta = session ?? null;
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    meta,
    games: games ?? [],
    keyframes: keyframes ?? [],
    errors: errors ?? [],
    stats: {
      gameCount: Array.isArray(games) ? games.length : 0,
      keyframeCount: Array.isArray(keyframes) ? keyframes.length : 0,
      errorCount: Array.isArray(errors) ? errors.length : 0,
    },
  };
}

async function writeJsonPretty(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function exportSessionJson({ db, sessionId, outPath }) {
  const session = db.getSession(sessionId);
  const games = db.getGames(sessionId);
  const keyframes = db.getKeyframes(sessionId);
  const errors = db.getErrors(sessionId);

  const doc = buildSessionDocument({
    session,
    games,
    keyframes,
    errors,
  });

  await writeJsonPretty(outPath, doc);
  return doc;
}

function escapeCsvValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replaceAll('"', '""')}"`;
}

function exportKeyframesCsvString({ db, sessionId }) {
  const session = db.getSession(sessionId);
  const keyframes = db.getKeyframes(sessionId);

  const header = [
    'sessionId',
    'startedAt',
    'endedAt',
    'matchType',
    'keyframeIndex',
    'capturedAt',
    'fileRelpath',
    'diffScore',
    'inMatch',
    'playerCount',
    'errorStage',
    'errorMessage',
  ];

  const lines = [header.map(escapeCsvValue).join(',')];
  for (const k of keyframes) {
    const snapshot = k.snapshot && typeof k.snapshot === 'object' ? k.snapshot : {};
    const err = k.error && typeof k.error === 'object' ? k.error : {};
    const row = [
      session?.sessionId ?? sessionId,
      session?.startedAt ?? '',
      session?.endedAt ?? '',
      session?.matchType ?? '',
      k.keyframeIndex,
      k.capturedAt,
      k.fileRelpath,
      k.diffScore ?? '',
      snapshot.inMatch ?? '',
      snapshot.playerCount ?? '',
      err.stage ?? '',
      err.message ?? '',
    ];
    lines.push(row.map(escapeCsvValue).join(','));
  }

  return `${lines.join('\n')}\n`;
}

async function exportKeyframesCsv({ db, sessionId, outPath }) {
  const csv = exportKeyframesCsvString({ db, sessionId });
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, csv, 'utf8');
  return csv;
}

module.exports = {
  buildSessionDocument,
  exportKeyframesCsv,
  exportKeyframesCsvString,
  exportSessionJson,
};

