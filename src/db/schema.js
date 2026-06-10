const SCHEMA_VERSION = 1;

function getSchemaSql() {
  return `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  platform TEXT NOT NULL,
  majsoul_url TEXT,
  window_width INTEGER,
  window_height INTEGER,
  match_type TEXT NOT NULL,
  last_error_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

CREATE TABLE IF NOT EXISTS games (
  game_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  game_index INTEGER NOT NULL,
  meta_json TEXT,
  started_at TEXT,
  ended_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, game_index)
);

CREATE TABLE IF NOT EXISTS keyframes (
  keyframe_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(game_id) ON DELETE SET NULL,
  keyframe_index INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  file_relpath TEXT NOT NULL,
  diff_score REAL,
  probe_json TEXT,
  inferred_json TEXT,
  snapshot_json TEXT,
  recognition_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(session_id, keyframe_index)
);

CREATE INDEX IF NOT EXISTS idx_keyframes_session_time ON keyframes(session_id, captured_at);

CREATE TABLE IF NOT EXISTS errors (
  error_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  keyframe_id INTEGER REFERENCES keyframes(keyframe_id) ON DELETE SET NULL,
  occurred_at TEXT NOT NULL,
  stage TEXT,
  message TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_errors_session_time ON errors(session_id, occurred_at);
`.trim();
}

module.exports = {
  SCHEMA_VERSION,
  getSchemaSql,
};

