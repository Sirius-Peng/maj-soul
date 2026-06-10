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

function getAdviceConfig() {
  const timeoutMs = Number(process.env.MAJSOUL_ADVICE_TIMEOUT_MS ?? 6000);
  return {
    enabled: String(process.env.MAJSOUL_ADVICE_ENABLED ?? '1') === '1',
    apiKey: String(process.env.DEEPSEEK_API_KEY ?? '').trim(),
    baseUrl: String(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com').trim(),
    model: String(process.env.DEEPSEEK_MODEL ?? 'deepseek-v4flash').trim(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 6000,
    strategy: String(process.env.MAJSOUL_ADVICE_STRATEGY ?? 'balanced').trim() || 'balanced',
  };
}

module.exports = {
  getAdviceConfig,
  getMajsoulUrl,
  getMainWindowOptions,
};
