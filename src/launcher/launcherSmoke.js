function waitForLauncherLoad(win) {
  if (!win || !win.webContents) {
    throw new Error('launcher window is unavailable');
  }

  if (typeof win.webContents.isLoading === 'function' && !win.webContents.isLoading()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback) => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    win.webContents.once('did-finish-load', () => finish(resolve));
    win.once('closed', () => finish(() => reject(new Error('launcher window closed before renderer finished loading'))));
  });
}

async function startSessionFromLauncherWindow(win) {
  await waitForLauncherLoad(win);
  return win.webContents.executeJavaScript('window.launcherApi.startSession()');
}

module.exports = {
  startSessionFromLauncherWindow,
  waitForLauncherLoad,
};
