const fs = require('node:fs/promises');
const path = require('node:path');

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function checkSessionConsistency({ db, sessionId, sessionDir }) {
  const issues = [];

  const session = db.getSession(sessionId);
  if (!session) {
    issues.push({ type: 'missing_session', sessionId });
    return { ok: false, issues };
  }

  if (!session.endedAt) {
    issues.push({ type: 'missing_ended_at', sessionId });
  }

  const keyframes = db.getKeyframes(sessionId);
  for (const k of keyframes) {
    const abs = path.join(sessionDir, k.fileRelpath);
    const exists = await fileExists(abs);
    if (!exists) {
      issues.push({
        type: 'missing_keyframe_file',
        sessionId,
        keyframeIndex: k.keyframeIndex,
        fileRelpath: k.fileRelpath,
      });
    }
  }

  try {
    const files = await fs.readdir(path.join(sessionDir, 'keyframes'));
    const pngCount = files.filter((f) => f.toLowerCase().endsWith('.png')).length;
    if (pngCount !== keyframes.length) {
      issues.push({
        type: 'keyframe_count_mismatch',
        sessionId,
        dbCount: keyframes.length,
        fsCount: pngCount,
      });
    }
  } catch {
    if (keyframes.length > 0) {
      issues.push({
        type: 'missing_keyframes_dir',
        sessionId,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

module.exports = {
  checkSessionConsistency,
};

