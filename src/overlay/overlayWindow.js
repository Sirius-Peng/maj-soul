const path = require('node:path');

function getOverlayWindowOptions(preloadPath) {
  return {
    width: 340,
    height: 260,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
    },
  };
}

function createOverlayWindow() {
  const { BrowserWindow, screen } = require('electron');
  const preloadPath = path.join(__dirname, 'preload.js');
  const win = new BrowserWindow(getOverlayWindowOptions(preloadPath));
  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  win.setPosition(Math.max(0, width - 360), 80);
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'index.html'));

  function sendState(payload) {
    if (win.isDestroyed()) return;
    win.webContents.send('overlay:state', payload);
  }

  return {
    win,
    showLoading(payload) {
      if (!win.isVisible()) win.showInactive();
      sendState({ status: 'loading', ...payload });
    },
    showReady(payload) {
      if (!win.isVisible()) win.showInactive();
      sendState({ status: 'ready', ...payload });
    },
    showError(payload) {
      if (!win.isVisible()) win.showInactive();
      sendState({ status: 'error', ...payload });
    },
    hide() {
      if (!win.isDestroyed()) win.hide();
    },
    close() {
      if (!win.isDestroyed()) win.close();
    },
  };
}

module.exports = {
  createOverlayWindow,
  getOverlayWindowOptions,
};
