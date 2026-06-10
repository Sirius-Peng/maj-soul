const path = require('node:path');

const { probeMajsoulState } = require('./probeMajsoulState');
const { getPlatformTag } = require('../session/sessionPaths');
const { createSessionRecorderCore } = require('./sessionRecorderCore');
const { getDefaultLayout } = require('../vision/defaultLayout');
const { loadTemplateBankFromDir } = require('../vision/templateBank');
const { CdpWebSocketTap } = require('../net/cdpWebSocketTap');
const { createOpportunityDetector } = require('../advice/opportunityDetector');

function getCaptureIntervalMs() {
  const n = Number(process.env.MAJSOUL_CAPTURE_INTERVAL_MS ?? 800);
  if (!Number.isFinite(n) || n <= 0) return 800;
  return n;
}

function getKeyframeThreshold() {
  const n = Number(process.env.MAJSOUL_KEYFRAME_THRESHOLD ?? 12);
  if (!Number.isFinite(n) || n < 0) return 12;
  return n;
}

function shouldCaptureAllFrames() {
  return String(process.env.MAJSOUL_CAPTURE_ALL_FRAMES ?? '').trim() === '1';
}

function getSessionsBaseDir({ userDataDir }) {
  const env = String(process.env.MAJSOUL_SESSIONS_DIR ?? '').trim();
  if (env) return env;
  return path.join(userDataDir, 'data');
}

async function startSessionRecorder({ win, userDataDir, majsoulUrl, configSnapshot = null, adviceServices = null }) {
  const webContents = win.webContents;
  let busy = false;
  const runtimeConfig = configSnapshot ?? { majsoulUrl };

  const intervalMs = getCaptureIntervalMs();
  const threshold = getKeyframeThreshold();
  const captureAll = shouldCaptureAllFrames();
  const baseDir = getSessionsBaseDir({ userDataDir });

  const shouldExportCsv = String(process.env.MAJSOUL_EXPORT_CSV ?? '').trim() === '1';
  const visionLayout = getDefaultLayout();
  const templatesDir = String(process.env.MAJSOUL_TEMPLATES_DIR ?? '').trim();
  const templateBank = await loadTemplateBankFromDir(templatesDir);
  const platformTag = getPlatformTag(process.platform);
  const opportunityDetector = adviceServices ? createOpportunityDetector({ seat: 0 }) : null;

  let tap = null;
  const core = await createSessionRecorderCore({
    baseDir,
    majsoulUrl: runtimeConfig.majsoulUrl,
    platformTag,
    window: () => {
      const bounds = win.getBounds();
      return { width: bounds.width, height: bounds.height };
    },
    captureAllFrames: captureAll,
    keyframeThreshold: threshold,
    shouldExportCsv,
    templateBank,
    visionLayout,
    deps: {
      now: () => new Date(),
      capture: async () => {
        const img = await webContents.capturePage();
        const size = img.getSize();
        return {
          width: size.width,
          height: size.height,
          bitmap: img.toBitmap(),
          png: img.toPNG(),
        };
      },
      probe: async () => probeMajsoulState(webContents),
      onSessionStarted: async ({ sessionId }) => {
        if (tap) tap.setSessionId(sessionId);
      },
      onSessionEnded: async () => {
        if (tap) tap.setSessionId(null);
      },
    },
  });

  if (adviceServices?.coordinator && typeof adviceServices.coordinator.setDb === 'function') {
    adviceServices.coordinator.setDb(core.db);
  }

  tap = new CdpWebSocketTap({
    webContents,
    db: core.db,
    onLiqiEvent: async (event) => {
      if (!adviceServices || !opportunityDetector) return;
      const frame = opportunityDetector.consumeEvent(event);
      if (!frame) return;

      core.db.insertDecisionFrame({
        sessionId: frame.sessionId,
        turnId: frame.turnId,
        operationType: frame.operationType,
        payload: frame,
      });

      await adviceServices.coordinator.handleDecisionFrame(frame);
    },
  });
  try {
    await tap.start();
  } catch {
    tap = null;
  }

  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await core.tick();
    } catch {
    } finally {
      busy = false;
    }
  }, intervalMs);

  win.on('closed', () => {
    clearInterval(timer);
    if (tap) tap.stop().catch(() => {});
    core.stop().catch(() => {});
  });

  return {
    stop: async () => {
      clearInterval(timer);
      if (tap) await tap.stop();
      await core.stop();
    },
  };
}

module.exports = {
  startSessionRecorder,
};
