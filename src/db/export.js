const fs = require('node:fs/promises');
const path = require('node:path');

function getExportEventsMax() {
  const raw = String(process.env.MAJSOUL_EXPORT_EVENTS_MAX ?? '').trim();
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function buildSessionDocument({ session, games, keyframes, errors, events, decisionFrames, adviceResults }) {
  const meta = session ?? null;
  const maxEvents = getExportEventsMax();
  const exportedEvents = Array.isArray(events)
    ? maxEvents > 0
      ? events.slice(Math.max(0, events.length - maxEvents))
      : events
    : [];
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    meta,
    games: games ?? [],
    keyframes: keyframes ?? [],
    errors: errors ?? [],
    events: exportedEvents,
    decisionFrames: decisionFrames ?? [],
    adviceResults: adviceResults ?? [],
    stats: {
      gameCount: Array.isArray(games) ? games.length : 0,
      keyframeCount: Array.isArray(keyframes) ? keyframes.length : 0,
      errorCount: Array.isArray(errors) ? errors.length : 0,
      eventCount: exportedEvents.length,
      decisionFrameCount: Array.isArray(decisionFrames) ? decisionFrames.length : 0,
      adviceResultCount: Array.isArray(adviceResults) ? adviceResults.length : 0,
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
  const events = db.getLiqiEvents(sessionId);
  const decisionFrames = db.getDecisionFrames(sessionId);
  const adviceResults = db.getAdviceResults(sessionId);

  const doc = buildSessionDocument({
    session,
    games,
    keyframes,
    errors,
    events,
    decisionFrames,
    adviceResults,
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
