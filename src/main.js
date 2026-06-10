const fs = require('node:fs/promises');
const path = require('node:path');

const { app, BrowserWindow, ipcMain, shell } = require('electron');

const {
  createRuntimeConfigSnapshot,
  getLauncherConfigPath,
  getMainWindowOptions,
  readPersistedLauncherConfig,
  writePersistedLauncherConfig,
} = require('./config');
const { createAdviceRuntime } = require('./launcher/adviceRuntime');
const { createLauncherController } = require('./launcher/launcherController');
const { startSessionFromLauncherWindow } = require('./launcher/launcherSmoke');
const { createLauncherWindow } = require('./launcher/launcherWindow');
const { startSessionRecorder } = require('./recorder/sessionRecorder');

function getLauncherSmokeResultPath() {
  const configuredPath = String(process.env.MAJSOUL_LAUNCHER_SMOKE_RESULT ?? '').trim();
  if (configuredPath) {
    return configuredPath;
  }

  return path.join(app.getPath('userData'), 'launcher-smoke.json');
}

async function writeLauncherSmokeResult(payload) {
  const filePath = getLauncherSmokeResultPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function maybeRunLauncherSmoke(launcher) {
  if (String(process.env.MAJSOUL_LAUNCHER_SMOKE ?? '').trim() !== '1') {
    return;
  }

  try {
    const state = await startSessionFromLauncherWindow(launcher.win);
    await writeLauncherSmokeResult({
      ok: true,
      state,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    process.exitCode = 1;
    await writeLauncherSmokeResult({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    });
  } finally {
    setTimeout(() => {
      app.quit();
    }, 1_000);
  }
}

async function createMajsoulWindow({ configSnapshot }) {
  const win = new BrowserWindow(getMainWindowOptions());

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(configSnapshot.majsoulUrl);
  return win;
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const configPath = getLauncherConfigPath({ userDataDir });
  let launcher = null;

  const controller = createLauncherController({
    userDataDir,
    loadPersistedConfig: async () => readPersistedLauncherConfig(configPath),
    savePersistedConfig: async (config) => writePersistedLauncherConfig(configPath, config),
    createRuntimeConfigSnapshot,
    createAdviceRuntime,
    createMainWindow: createMajsoulWindow,
    startSessionRecorder,
  });

  function ensureLauncherWindow() {
    if (launcher && launcher.win && !launcher.win.isDestroyed()) {
      return launcher;
    }

    launcher = createLauncherWindow();
    launcher.win.on('closed', () => {
      launcher = null;
    });
    launcher.sendState(controller.getState());
    return launcher;
  }

  controller.subscribe((state) => {
    if (launcher && launcher.win && !launcher.win.isDestroyed()) {
      launcher.sendState(state);
    }
  });

  ipcMain.handle('launcher:get-state', async () => controller.getState());
  ipcMain.handle('launcher:save-config', async (_event, config) => controller.saveConfig(config));
  ipcMain.handle('launcher:start-session', async () => {
    await controller.startSession();
    return controller.getState();
  });
  ipcMain.handle('launcher:stop-session', async () => {
    await controller.stopSession();
    return controller.getState();
  });

  await controller.initialize();
  const readyLauncher = ensureLauncherWindow();
  readyLauncher.sendState(controller.getState());
  maybeRunLauncherSmoke(readyLauncher).catch(async (error) => {
    process.exitCode = 1;
    await writeLauncherSmokeResult({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    }).catch(() => {});
    app.quit();
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      ensureLauncherWindow().sendState(controller.getState());
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
