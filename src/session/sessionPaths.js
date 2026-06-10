const path = require('node:path');

function pad(num, len) {
  return String(num).padStart(len, '0');
}

function formatTimestampForSession(date) {
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1, 2);
  const day = pad(date.getUTCDate(), 2);
  const hour = pad(date.getUTCHours(), 2);
  const minute = pad(date.getUTCMinutes(), 2);
  const second = pad(date.getUTCSeconds(), 2);
  const ms = pad(date.getUTCMilliseconds(), 3);
  return `${year}${month}${day}_${hour}${minute}${second}_${ms}`;
}

function getPlatformTag(platform) {
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'win';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

function buildSessionId({ startedAt, platformTag }) {
  return `${formatTimestampForSession(startedAt)}_${platformTag}`;
}

function getSessionLayout(baseDir, sessionId) {
  const sessionDir = path.join(baseDir, 'sessions', sessionId);
  return {
    sessionId,
    sessionDir,
    framesDir: path.join(sessionDir, 'frames'),
    keyframesDir: path.join(sessionDir, 'keyframes'),
    metaPath: path.join(sessionDir, 'session.json'),
  };
}

module.exports = {
  buildSessionId,
  formatTimestampForSession,
  getPlatformTag,
  getSessionLayout,
};

