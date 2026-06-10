function getMajsoulUrl() {
  const raw = process.env.MAJSOUL_URL?.trim();
  if (raw) return raw;
  return 'https://game.maj-soul.com/1/';
}

function getMainWindowOptions() {
  return {
    width: 1280,
    height: 720,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  };
}

module.exports = {
  getMajsoulUrl,
  getMainWindowOptions,
};
