const SCHEMA_VERSION = 3;

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

CREATE TABLE IF NOT EXISTS ws_frames (
  frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  direction TEXT NOT NULL,
  url TEXT,
  opcode INTEGER NOT NULL,
  payload_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ws_frames_session_time ON ws_frames(session_id, captured_at);

CREATE TABLE IF NOT EXISTS liqi_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  frame_id INTEGER REFERENCES ws_frames(frame_id) ON DELETE SET NULL,
  captured_at TEXT NOT NULL,
  msg_type TEXT NOT NULL,
  method TEXT,
  step INTEGER,
  action_name TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liqi_events_session_time ON liqi_events(session_id, captured_at);

CREATE TABLE IF NOT EXISTS decision_frames (
  frame_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_frames_session_time ON decision_frames(session_id, created_at);

CREATE TABLE IF NOT EXISTS advice_requests (
  request_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  request_payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_advice_requests_session_time ON advice_requests(session_id, created_at);

CREATE TABLE IF NOT EXISTS advice_results (
  result_id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_id TEXT NOT NULL,
  request_id INTEGER REFERENCES advice_requests(request_id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  result_json TEXT,
  error_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_advice_results_session_time ON advice_results(session_id, created_at);
`.trim();
}

module.exports = {
  SCHEMA_VERSION,
  getSchemaSql,
};
