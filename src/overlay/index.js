const els = {
  title: document.getElementById('title'),
  statusBadge: document.getElementById('status-badge'),
  primaryLabel: document.getElementById('primary-label'),
  primaryProbability: document.getElementById('primary-probability'),
  primaryReason: document.getElementById('primary-reason'),
  primaryRisk: document.getElementById('primary-risk'),
  alternatives: document.getElementById('alternatives'),
  meta: document.getElementById('meta'),
};

function setBadge(status) {
  els.statusBadge.className = `badge badge--${status}`;
  els.statusBadge.textContent =
    status === 'ready' ? '已更新' : status === 'error' ? '失败' : '分析中';
}

function renderAlternatives(alternatives) {
  els.alternatives.innerHTML = '';
  for (const item of alternatives.slice(0, 3)) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.className = 'alt__label';
    label.textContent = item.label ?? item.type ?? '未知动作';
    const probability = document.createElement('span');
    probability.className = 'alt__probability';
    probability.textContent =
      typeof item.probability === 'number' ? `${Math.round(item.probability * 100)}%` : '--';
    li.append(label, probability);
    els.alternatives.append(li);
  }
}

function renderState(payload) {
  const status = payload?.status ?? 'loading';
  setBadge(status);

  if (status === 'loading') {
    els.title.textContent = '检测到可操作回合';
    els.primaryLabel.textContent = '正在分析...';
    els.primaryProbability.textContent = '--';
    els.primaryReason.textContent = '系统正在根据当前事实流与合法动作集合生成建议。';
    els.primaryRisk.textContent = '';
    renderAlternatives([]);
    els.meta.textContent = 'balanced · 数据完整度待确认 · -- ms';
    return;
  }

  if (status === 'error') {
    els.title.textContent = '建议生成失败';
    els.primaryLabel.textContent = '请等待下一次操作机会';
    els.primaryProbability.textContent = '--';
    els.primaryReason.textContent = payload?.error?.message ?? '未知错误';
    els.primaryRisk.textContent = '';
    renderAlternatives([]);
    els.meta.textContent = 'balanced · 数据完整度未知 · -- ms';
    return;
  }

  const result = payload?.result ?? {};
  const main = result.recommendedAction ?? {};
  els.title.textContent = result.summary || '实时建议';
  els.primaryLabel.textContent = main.label ?? main.type ?? '未知动作';
  els.primaryProbability.textContent =
    typeof main.probability === 'number' ? `${Math.round(main.probability * 100)}%` : '--';
  els.primaryReason.textContent = main.reason ?? '无解释';
  els.primaryRisk.textContent = main.risk ? `风险：${main.risk}` : '';
  renderAlternatives(result.alternatives ?? []);

  const notes = result.modelNotes ?? {};
  els.meta.textContent = `${notes.style ?? 'balanced'} · 数据完整度 ${notes.inputCompleteness ?? '未知'} · ${
    payload.latencyMs ?? '--'
  } ms`;
}

window.overlayApi.onState(renderState);
renderState({ status: 'loading' });

