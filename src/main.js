const { app, BrowserWindow, shell } = require('electron');

const { getMajsoulUrl, getMainWindowOptions } = require('./config');
const { startSessionRecorder } = require('./recorder/sessionRecorder');

async function createMainWindow() {
  const win = new BrowserWindow(getMainWindowOptions());

  win.once('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(getMajsoulUrl());
  return win;
}

app.whenReady().then(async () => {
  const win = await createMainWindow();
  await startSessionRecorder({
    win,
    userDataDir: app.getPath('userData'),
    majsoulUrl: getMajsoulUrl(),
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = await createMainWindow();
      await startSessionRecorder({
        win: newWin,
        userDataDir: app.getPath('userData'),
        majsoulUrl: getMajsoulUrl(),
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
