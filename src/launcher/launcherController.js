const {
  createRuntimeConfigSnapshot: defaultCreateRuntimeConfigSnapshot,
  getAdviceRuntimeState: defaultGetAdviceRuntimeState,
} = require('../config');
const { createAdviceRuntime: defaultCreateAdviceRuntime } = require('./adviceRuntime');

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function safeCall(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function createLauncherController({
  userDataDir,
  env = process.env,
  loadPersistedConfig,
  savePersistedConfig,
  createRuntimeConfigSnapshot,
  createRuntimeConfigSnapshotImpl = createRuntimeConfigSnapshot ?? defaultCreateRuntimeConfigSnapshot,
  getAdviceRuntimeState,
  getAdviceRuntimeStateImpl = getAdviceRuntimeState ?? defaultGetAdviceRuntimeState,
  createAdviceRuntime,
  createAdviceRuntimeImpl = createAdviceRuntime ?? defaultCreateAdviceRuntime,
  createMainWindow,
  startSessionRecorder,
} = {}) {
  if (typeof loadPersistedConfig !== 'function') {
    throw new Error('loadPersistedConfig must be a function');
  }
  if (typeof savePersistedConfig !== 'function') {
    throw new Error('savePersistedConfig must be a function');
  }
  if (typeof createMainWindow !== 'function') {
    throw new Error('createMainWindow must be a function');
  }
  if (typeof startSessionRecorder !== 'function') {
    throw new Error('startSessionRecorder must be a function');
  }

  let persistedConfig = null;
  let state = {
    config: null,
    status: {
      phase: 'idle',
      warning: null,
      error: null,
    },
  };
  let activeSession = null;
  let startingSession = null;
  const listeners = new Set();

  function emitState() {
    const payload = {
      config: state.config ? cloneConfig(state.config) : null,
      status: { ...state.status },
    };
    for (const listener of listeners) {
      listener(payload);
    }
  }

  function setState(partial) {
    state = {
      ...state,
      ...partial,
      status: {
        ...state.status,
        ...(partial.status ?? {}),
      },
    };
    emitState();
  }

  function refreshIdleStatus(config = persistedConfig) {
    if (!config) {
      return;
    }

    const configSnapshot = createRuntimeConfigSnapshotImpl({
      persistedConfig: config,
      env,
    });
    const adviceState = getAdviceRuntimeStateImpl(configSnapshot);
    setState({
      config,
      status: {
        phase: 'idle',
        warning: adviceState.warning,
        error: null,
      },
    });
  }

  async function finalizeSessionStop(session) {
    if (!session || session.stopped) {
      return;
    }

    session.stopped = true;
    if (activeSession === session) {
      activeSession = null;
      startingSession = null;
      refreshIdleStatus();
    }
    if (session.recorder && typeof session.recorder.stop === 'function') {
      await session.recorder.stop();
    }
    if (session.overlay) {
      if (typeof session.overlay.close === 'function') {
        safeCall(() => session.overlay.close());
      } else if (typeof session.overlay.hide === 'function') {
        safeCall(() => session.overlay.hide());
      }
    }
  }

  async function initialize() {
    persistedConfig = await loadPersistedConfig();
    refreshIdleStatus();
    return getState();
  }

  async function saveConfig(nextConfig) {
    persistedConfig = await savePersistedConfig(nextConfig);
    if (!activeSession) {
      refreshIdleStatus();
    } else {
      setState({
        config: persistedConfig,
      });
    }
    return getState();
  }

  async function startSession() {
    if (activeSession) {
      return activeSession;
    }
    if (startingSession) {
      return startingSession;
    }

    setState({
      status: {
        phase: 'starting',
        error: null,
      },
    });

    const pending = (async () => {
      const configSnapshot = createRuntimeConfigSnapshotImpl({
        persistedConfig,
        env,
      });
      const adviceRuntime = createAdviceRuntimeImpl({ configSnapshot });
      const win = await createMainWindow({ configSnapshot });

      const session = {
        configSnapshot,
        warning: adviceRuntime.warning,
        overlay: adviceRuntime.overlay,
        win,
        recorder: null,
        stopped: false,
      };

      win.on('closed', () => {
        finalizeSessionStop(session).catch(() => {});
      });

      session.recorder = await startSessionRecorder({
        win,
        userDataDir,
        configSnapshot,
        adviceServices: adviceRuntime.services,
      });

      activeSession = session;
      startingSession = null;
      setState({
        config: persistedConfig,
        status: {
          phase: 'running',
          warning: session.warning,
          error: null,
        },
      });
      return session;
    })();

    startingSession = pending;
    try {
      return await pending;
    } catch (error) {
      startingSession = null;
      setState({
        status: {
          phase: 'idle',
          warning: state.status.warning,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  async function stopSession() {
    const session = activeSession;
    if (!session) {
      return null;
    }

    setState({
      status: {
        phase: 'stopping',
        warning: session.warning,
        error: null,
      },
    });

    await finalizeSessionStop(session);
    if (session.win && typeof session.win.isDestroyed === 'function' && !session.win.isDestroyed()) {
      session.win.close();
    }
    return null;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return {
      config: state.config ? cloneConfig(state.config) : null,
      status: { ...state.status },
    };
  }

  return {
    getState,
    initialize,
    saveConfig,
    startSession,
    stopSession,
    subscribe,
  };
}

module.exports = {
  createLauncherController,
};
