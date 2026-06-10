const els = {
  form: document.getElementById('launcher-form'),
  majsoulUrl: document.getElementById('majsoulUrl'),
  adviceEnabled: document.getElementById('adviceEnabled'),
  apiKey: document.getElementById('apiKey'),
  baseUrl: document.getElementById('baseUrl'),
  model: document.getElementById('model'),
  timeoutMs: document.getElementById('timeoutMs'),
  strategy: document.getElementById('strategy'),
  saveButton: document.getElementById('save-button'),
  startButton: document.getElementById('start-button'),
  stopButton: document.getElementById('stop-button'),
  statusPhase: document.getElementById('status-phase'),
  statusBadge: document.getElementById('status-badge'),
  notice: document.getElementById('notice'),
};

function setNotice(message, tone = 'warning') {
  if (!message) {
    els.notice.hidden = true;
    els.notice.textContent = '';
    els.notice.className = 'notice';
    return;
  }

  els.notice.hidden = false;
  els.notice.textContent = message;
  els.notice.className = `notice notice--${tone}`;
}

function updateButtons(phase) {
  const busy = phase === 'starting' || phase === 'stopping';
  els.saveButton.disabled = busy;
  els.startButton.disabled = busy || phase === 'running';
  els.stopButton.disabled = busy || phase !== 'running';
}

function renderState(state) {
  const config = state?.config ?? {};
  const advice = config.advice ?? {};
  const status = state?.status ?? { phase: 'idle', warning: null, error: null };

  els.majsoulUrl.value = config.majsoulUrl ?? '';
  els.adviceEnabled.checked = Boolean(advice.enabled);
  els.apiKey.value = advice.apiKey ?? '';
  els.baseUrl.value = advice.baseUrl ?? '';
  els.model.value = advice.model ?? '';
  els.timeoutMs.value = advice.timeoutMs ?? '';
  els.strategy.value = advice.strategy ?? '';

  const badgeLabel = {
    idle: 'Idle',
    starting: 'Starting',
    running: 'Running',
    stopping: 'Stopping',
  }[status.phase] ?? 'Idle';
  const phaseLabel = {
    idle: '空闲',
    starting: '正在启动',
    running: '运行中',
    stopping: '正在停止',
  }[status.phase] ?? '空闲';

  els.statusPhase.textContent = phaseLabel;
  els.statusBadge.textContent = badgeLabel;
  els.statusBadge.className = `badge badge--${status.phase}`;
  updateButtons(status.phase);

  if (status.error) {
    setNotice(status.error, 'error');
    return;
  }
  if (status.warning) {
    setNotice(status.warning, 'warning');
    return;
  }
  setNotice('');
}

function collectConfig() {
  return {
    majsoulUrl: els.majsoulUrl.value,
    advice: {
      enabled: els.adviceEnabled.checked,
      apiKey: els.apiKey.value,
      baseUrl: els.baseUrl.value,
      model: els.model.value,
      timeoutMs: els.timeoutMs.value,
      strategy: els.strategy.value,
    },
  };
}

async function runAction(action, onErrorTone = 'error') {
  try {
    await action();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : String(error), onErrorTone);
  }
}

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runAction(async () => {
    const state = await window.launcherApi.saveConfig(collectConfig());
    renderState(state);
    setNotice('配置已保存', 'warning');
  });
});

els.startButton.addEventListener('click', async () => {
  await runAction(async () => {
    const savedState = await window.launcherApi.saveConfig(collectConfig());
    renderState(savedState);
    await window.launcherApi.startSession();
  });
});

els.stopButton.addEventListener('click', async () => {
  await runAction(async () => {
    await window.launcherApi.stopSession();
  });
});

window.launcherApi.onState(renderState);
window.launcherApi
  .getState()
  .then(renderState)
  .catch((error) => setNotice(error instanceof Error ? error.message : String(error), 'error'));
