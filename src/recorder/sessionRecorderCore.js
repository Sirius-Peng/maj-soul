const fs = require('node:fs/promises');
const path = require('node:path');

const { shouldMarkKeyframe } = require('../capture/keyframeDiff');
const { checkSessionConsistency } = require('../db/consistency');
const { exportKeyframesCsv, exportSessionJson } = require('../db/export');
const { MajsoulDb } = require('../db/majsoulDb');
const { buildSessionId, getSessionLayout } = require('../session/sessionPaths');
const { writeSessionMetadata } = require('../session/sessionMetadata');
const { GameLifecycleDetector } = require('../session/lifecycleDetector');
const { detectMatchTypeFromProbe } = require('../session/matchTypeDetector');
const { inferInMatchFromFrame, inferPlayerCountFromFrame } = require('../session/frameHeuristics');
const { getDefaultLayout } = require('../vision/defaultLayout');
const { recognizeFrame: recognizeFrameDefault } = require('../vision/recognizeFrame');

async function ensureSessionDirs(layout) {
  await fs.mkdir(layout.framesDir, { recursive: true });
  await fs.mkdir(layout.keyframesDir, { recursive: true });
}

async function writePng(filePath, pngBuffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pngBuffer);
}

function buildFrameFileName(frameIndex, ts) {
  return `${String(frameIndex).padStart(8, '0')}_${ts}.png`;
}

function defaultNow() {
  return new Date();
}

function buildNowForName(iso) {
  return iso.replaceAll(':', '').replaceAll('.', '');
}

async function createSessionRecorderCore({
  baseDir,
  majsoulUrl,
  platformTag,
  window,
  captureAllFrames = false,
  keyframeThreshold = 12,
  shouldExportCsv = false,
  templateBank = { tiles: [], digits: [] },
  visionLayout = getDefaultLayout(),
  deps,
}) {
  if (!baseDir) throw new Error('baseDir is required');
  if (!deps || typeof deps !== 'object') throw new Error('deps is required');
  if (typeof deps.capture !== 'function') throw new Error('deps.capture is required');
  if (typeof deps.probe !== 'function') throw new Error('deps.probe is required');

  const now = typeof deps.now === 'function' ? deps.now : defaultNow;
  const recognizeFrame = typeof deps.recognizeFrame === 'function' ? deps.recognizeFrame : recognizeFrameDefault;
  const keyframeDecider =
    typeof deps.keyframeDecider === 'function'
      ? deps.keyframeDecider
      : ({ prevBitmap, nextBitmap, threshold }) =>
          shouldMarkKeyframe({ prevRgba: prevBitmap, nextRgba: nextBitmap, threshold });

  await fs.mkdir(baseDir, { recursive: true });
  const db = new MajsoulDb(path.join(baseDir, 'majsoul.sqlite'));
  const lifecycle = new GameLifecycleDetector();

  let current = null;
  let frameIndex = 0;
  let keyframeIndex = 0;
  let prevKeyframeBitmap = null;
  let ticking = false;

  async function finalizeCurrent() {
    if (!current) return;

    current.meta.endedAt = now().toISOString();
    await writeSessionMetadata(current.layout.metaPath, current.meta);
    db.upsertSession(current.meta);

    const consistency = await checkSessionConsistency({
      db,
      sessionId: current.meta.sessionId,
      sessionDir: current.layout.sessionDir,
    });

    if (!consistency.ok) {
      for (const issue of consistency.issues) {
        db.insertError({
          sessionId: current.meta.sessionId,
          occurredAt: current.meta.endedAt,
          stage: 'consistency',
          message: issue.type,
          detail: issue,
        });
      }
    }

    await exportSessionJson({
      db,
      sessionId: current.meta.sessionId,
      outPath: current.layout.metaPath,
    });

    if (shouldExportCsv) {
      await exportKeyframesCsv({
        db,
        sessionId: current.meta.sessionId,
        outPath: path.join(current.layout.sessionDir, 'keyframes.csv'),
      });
    }

    current = null;
    prevKeyframeBitmap = null;
  }

  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const captured = await deps.capture();
      const width = captured?.width ?? 0;
      const height = captured?.height ?? 0;
      const bitmap = captured?.bitmap ?? null;
      const png = captured?.png ?? null;

      const rawProbe = await deps.probe();

      const inferredInMatch =
        typeof rawProbe?.inMatch === 'boolean'
          ? undefined
          : inferInMatchFromFrame({ bitmap, width, height });
      const inferredPlayerCount =
        typeof rawProbe?.playerCount === 'number'
          ? undefined
          : inferPlayerCountFromFrame({ bitmap, width, height });

      const inMatch = typeof rawProbe?.inMatch === 'boolean' ? rawProbe.inMatch : inferredInMatch;
      const playerCount =
        typeof rawProbe?.playerCount === 'number' ? rawProbe.playerCount : inferredPlayerCount;

      const events = lifecycle.update({ inMatch: Boolean(inMatch) });

      for (const e of events) {
        if (e.type === 'match_started') {
          const startedAtDate = now();
          const startedAt = startedAtDate.toISOString();
          const sessionId = buildSessionId({ startedAt: startedAtDate, platformTag });
          const layout = getSessionLayout(baseDir, sessionId);
          await ensureSessionDirs(layout);

          const matchType = detectMatchTypeFromProbe({ playerCount });
          const winMeta = typeof window === 'function' ? window() : window;

          current = {
            layout,
            meta: {
              sessionId,
              startedAt,
              platform: platformTag,
              majsoulUrl,
              window: winMeta ?? null,
              matchType,
            },
          };

          frameIndex = 0;
          keyframeIndex = 0;
          prevKeyframeBitmap = null;

          await writeSessionMetadata(layout.metaPath, current.meta);
          db.upsertSession(current.meta);
        }

        if (e.type === 'match_ended') {
          await finalizeCurrent();
        }
      }

      if (!current) return;

      const capturedAt = now().toISOString();
      const nowForName = buildNowForName(capturedAt);

      if (current.meta.matchType === 'unknown') {
        const matchType = detectMatchTypeFromProbe({ playerCount });
        if (matchType !== 'unknown') {
          current.meta.matchType = matchType;
          await writeSessionMetadata(current.layout.metaPath, current.meta);
          db.upsertSession(current.meta);
        }
      }

      if (captureAllFrames && png) {
        const name = buildFrameFileName(frameIndex, nowForName);
        await writePng(path.join(current.layout.framesDir, name), png);
      }

      const decision =
        prevKeyframeBitmap === null
          ? { isKeyframe: true, score: keyframeThreshold }
          : keyframeDecider({ prevBitmap: prevKeyframeBitmap, nextBitmap: bitmap, threshold: keyframeThreshold });

      if (decision?.isKeyframe && png) {
        const thisKeyframeIndex = keyframeIndex;
        const name = buildFrameFileName(thisKeyframeIndex, nowForName);
        await writePng(path.join(current.layout.keyframesDir, name), png);

        let recognition = undefined;
        try {
          recognition = recognizeFrame({
            bitmap,
            width,
            height,
            bank: templateBank,
            layout: visionLayout,
          });
        } catch (err) {
          recognition = {
            error: {
              stage: 'vision',
              message: err instanceof Error ? err.message : String(err),
            },
          };
        }

        db.insertKeyframe({
          sessionId: current.meta.sessionId,
          keyframeIndex: thisKeyframeIndex,
          capturedAt,
          fileRelpath: `keyframes/${name}`,
          diffScore: decision?.score ?? null,
          probe: rawProbe,
          inferred: {
            inferredInMatch,
            inferredPlayerCount,
          },
          snapshot: {
            inMatch: Boolean(inMatch),
            playerCount: Number.isFinite(playerCount) ? playerCount : null,
            matchType: current.meta.matchType,
          },
          recognition,
        });

        prevKeyframeBitmap = bitmap;
        keyframeIndex += 1;
      }

      frameIndex += 1;
    } catch (err) {
      if (current) {
        current.meta.lastErrorAt = now().toISOString();
        try {
          db.insertError({
            sessionId: current.meta.sessionId,
            occurredAt: current.meta.lastErrorAt,
            stage: 'recorder',
            message: err instanceof Error ? err.message : String(err),
          });
          db.upsertSession(current.meta);
        } catch {}
        try {
          await writeSessionMetadata(current.layout.metaPath, current.meta);
        } catch {}
      }
    } finally {
      ticking = false;
    }
  }

  async function stop() {
    await finalizeCurrent();
    try {
      db.close();
    } catch {}
  }

  return {
    tick,
    stop,
  };
}

module.exports = {
  createSessionRecorderCore,
};
