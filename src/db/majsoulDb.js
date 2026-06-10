const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const { SCHEMA_VERSION, getSchemaSql } = require('./schema');

function nowIso() {
  return new Date().toISOString();
}

function safeJsonStringify(value) {
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function safeJsonParse(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

class MajsoulDb {
  constructor(dbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this._init();
    this._prepare();
  }

  close() {
    this.db.close();
  }

  _init() {
    const sql = getSchemaSql();
    this.db.exec(sql);

    const getVersion = this.db.prepare(
      'SELECT value FROM schema_meta WHERE key = $key LIMIT 1',
    );
    const row = getVersion.get({ key: 'schema_version' });
    const version = row ? Number(row.value) : null;

    if (version === SCHEMA_VERSION) return;

    const setVersion = this.db.prepare(
      'INSERT INTO schema_meta(key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    setVersion.run({ key: 'schema_version', value: String(SCHEMA_VERSION) });
  }

  _prepare() {
    this.stmtUpsertSession = this.db.prepare(`
INSERT INTO sessions(
  session_id, started_at, ended_at, platform, majsoul_url, window_width, window_height, match_type, last_error_at, created_at, updated_at
) VALUES (
  $session_id, $started_at, $ended_at, $platform, $majsoul_url, $window_width, $window_height, $match_type, $last_error_at, $created_at, $updated_at
) ON CONFLICT(session_id) DO UPDATE SET
  started_at = excluded.started_at,
  ended_at = excluded.ended_at,
  platform = excluded.platform,
  majsoul_url = excluded.majsoul_url,
  window_width = excluded.window_width,
  window_height = excluded.window_height,
  match_type = excluded.match_type,
  last_error_at = excluded.last_error_at,
  updated_at = excluded.updated_at
`.trim());

    this.stmtInsertKeyframe = this.db.prepare(`
INSERT INTO keyframes(
  session_id, game_id, keyframe_index, captured_at, file_relpath, diff_score, probe_json, inferred_json, snapshot_json, recognition_json, error_json, created_at
) VALUES (
  $session_id, $game_id, $keyframe_index, $captured_at, $file_relpath, $diff_score, $probe_json, $inferred_json, $snapshot_json, $recognition_json, $error_json, $created_at
) ON CONFLICT(session_id, keyframe_index) DO UPDATE SET
  captured_at = excluded.captured_at,
  file_relpath = excluded.file_relpath,
  diff_score = excluded.diff_score,
  probe_json = excluded.probe_json,
  inferred_json = excluded.inferred_json,
  snapshot_json = excluded.snapshot_json,
  recognition_json = excluded.recognition_json,
  error_json = excluded.error_json
`.trim());

    this.stmtInsertError = this.db.prepare(`
INSERT INTO errors(
  session_id, keyframe_id, occurred_at, stage, message, detail_json, created_at
) VALUES (
  $session_id, $keyframe_id, $occurred_at, $stage, $message, $detail_json, $created_at
)
`.trim());

    this.stmtSelectSession = this.db.prepare('SELECT * FROM sessions WHERE session_id = $session_id');
    this.stmtSelectGames = this.db.prepare(
      'SELECT * FROM games WHERE session_id = $session_id ORDER BY game_index ASC',
    );
    this.stmtSelectKeyframes = this.db.prepare(
      'SELECT * FROM keyframes WHERE session_id = $session_id ORDER BY keyframe_index ASC',
    );
    this.stmtSelectErrors = this.db.prepare(
      'SELECT * FROM errors WHERE session_id = $session_id ORDER BY occurred_at ASC, error_id ASC',
    );

    this.stmtListSessionsByTime = this.db.prepare(
      'SELECT * FROM sessions WHERE started_at >= $start AND started_at <= $end ORDER BY started_at ASC, session_id ASC',
    );
    this.stmtListKeyframesByTime = this.db.prepare(
      'SELECT * FROM keyframes WHERE captured_at >= $start AND captured_at <= $end ORDER BY captured_at ASC, keyframe_id ASC',
    );
  }

  upsertSession(meta) {
    const t = nowIso();
    this.stmtUpsertSession.run({
      session_id: meta.sessionId,
      started_at: meta.startedAt,
      ended_at: meta.endedAt ?? null,
      platform: meta.platform,
      majsoul_url: meta.majsoulUrl ?? null,
      window_width: meta.window?.width ?? null,
      window_height: meta.window?.height ?? null,
      match_type: meta.matchType ?? 'unknown',
      last_error_at: meta.lastErrorAt ?? null,
      created_at: t,
      updated_at: t,
    });
  }

  insertKeyframe({
    sessionId,
    gameId = null,
    keyframeIndex,
    capturedAt,
    fileRelpath,
    diffScore = null,
    probe = undefined,
    inferred = undefined,
    snapshot = undefined,
    recognition = undefined,
    error = undefined,
  }) {
    this.stmtInsertKeyframe.run({
      session_id: sessionId,
      game_id: gameId,
      keyframe_index: keyframeIndex,
      captured_at: capturedAt,
      file_relpath: fileRelpath,
      diff_score: diffScore,
      probe_json: safeJsonStringify(probe),
      inferred_json: safeJsonStringify(inferred),
      snapshot_json: safeJsonStringify(snapshot),
      recognition_json: safeJsonStringify(recognition),
      error_json: safeJsonStringify(error),
      created_at: nowIso(),
    });
  }

  insertError({ sessionId, keyframeId = null, occurredAt, stage, message, detail = undefined }) {
    this.stmtInsertError.run({
      session_id: sessionId,
      keyframe_id: keyframeId,
      occurred_at: occurredAt,
      stage: stage ?? null,
      message: message ?? null,
      detail_json: safeJsonStringify(detail),
      created_at: nowIso(),
    });
  }

  getSession(sessionId) {
    const row = this.stmtSelectSession.get({ session_id: sessionId });
    if (!row) return null;
    return {
      sessionId: row.session_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      platform: row.platform,
      majsoulUrl: row.majsoul_url,
      window: {
        width: row.window_width,
        height: row.window_height,
      },
      matchType: row.match_type,
      lastErrorAt: row.last_error_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  listSessionsByTime(start, end) {
    const rows = this.stmtListSessionsByTime.all({ start, end });
    return rows.map((row) => ({
      sessionId: row.session_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      platform: row.platform,
      majsoulUrl: row.majsoul_url,
      window: {
        width: row.window_width,
        height: row.window_height,
      },
      matchType: row.match_type,
      lastErrorAt: row.last_error_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getGames(sessionId) {
    const rows = this.stmtSelectGames.all({ session_id: sessionId });
    return rows.map((r) => ({
      gameId: r.game_id,
      sessionId: r.session_id,
      gameIndex: r.game_index,
      meta: safeJsonParse(r.meta_json),
      startedAt: r.started_at,
      endedAt: r.ended_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getKeyframes(sessionId) {
    const rows = this.stmtSelectKeyframes.all({ session_id: sessionId });
    return rows.map((r) => ({
      keyframeId: r.keyframe_id,
      sessionId: r.session_id,
      gameId: r.game_id,
      keyframeIndex: r.keyframe_index,
      capturedAt: r.captured_at,
      fileRelpath: r.file_relpath,
      diffScore: r.diff_score,
      probe: safeJsonParse(r.probe_json),
      inferred: safeJsonParse(r.inferred_json),
      snapshot: safeJsonParse(r.snapshot_json),
      recognition: safeJsonParse(r.recognition_json),
      error: safeJsonParse(r.error_json),
      createdAt: r.created_at,
    }));
  }

  listKeyframesByTime(start, end) {
    const rows = this.stmtListKeyframesByTime.all({ start, end });
    return rows.map((r) => ({
      keyframeId: r.keyframe_id,
      sessionId: r.session_id,
      gameId: r.game_id,
      keyframeIndex: r.keyframe_index,
      capturedAt: r.captured_at,
      fileRelpath: r.file_relpath,
      diffScore: r.diff_score,
      probe: safeJsonParse(r.probe_json),
      inferred: safeJsonParse(r.inferred_json),
      snapshot: safeJsonParse(r.snapshot_json),
      recognition: safeJsonParse(r.recognition_json),
      error: safeJsonParse(r.error_json),
      createdAt: r.created_at,
    }));
  }

  getErrors(sessionId) {
    const rows = this.stmtSelectErrors.all({ session_id: sessionId });
    return rows.map((r) => ({
      errorId: r.error_id,
      sessionId: r.session_id,
      keyframeId: r.keyframe_id,
      occurredAt: r.occurred_at,
      stage: r.stage,
      message: r.message,
      detail: safeJsonParse(r.detail_json),
      createdAt: r.created_at,
    }));
  }
}

module.exports = {
  MajsoulDb,
};
