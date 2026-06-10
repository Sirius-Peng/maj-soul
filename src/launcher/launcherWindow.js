const path = require('node:path');

function getLauncherWindowOptions(preloadPath) {
  return {
    width: 460,
    height: 760,
    minWidth: 420,
    minHeight: 700,
    title: '雀魂启动器',
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  };
}

function createLauncherWindow({
  BrowserWindowImpl,
  preloadPath = path.join(__dirname, 'preload.js'),
  htmlPath = path.join(__dirname, 'index.html'),
} = {}) {
  const { BrowserWindow } = require('electron');
  const ResolvedBrowserWindow = BrowserWindowImpl ?? BrowserWindow;
  const win = new ResolvedBrowserWindow(getLauncherWindowOptions(preloadPath));

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile(htmlPath);

  return {
    win,
    sendState(payload) {
      if (!win.isDestroyed()) {
        win.webContents.send('launcher:state', payload);
      }
    },
  };
}

module.exports = {
  createLauncherWindow,
  getLauncherWindowOptions,
};
