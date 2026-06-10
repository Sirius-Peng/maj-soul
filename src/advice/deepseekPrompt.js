function buildSystemPrompt() {
  return [
    '你是雀魂实时操作建议助手。',
    '只能在 legalActions 中选择动作。',
    '输出必须是 JSON。',
    'probability 表示相对推荐权重，不是严格胜率。',
    '如果信息不足，降低 confidence 并说明。',
    '每个候选都要提供简短理由与风险。',
  ].join('\n');
}

function buildUserPayload(frame, strategy) {
  return {
    turnId: frame.turnId,
    operationType: frame.operationType ?? 'unknown',
    strategyProfile: strategy,
    legalActions: Array.isArray(frame.legalActions) ? frame.legalActions : [],
    gameSnapshot: frame.gameSnapshot ?? {},
    recentEvents: Array.isArray(frame.recentEvents) ? frame.recentEvents : [],
    uiEvidence: frame.uiEvidence ?? {},
  };
}

function buildChatRequest(frame, strategy, model) {
  return {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: JSON.stringify(buildUserPayload(frame, strategy)) },
    ],
  };
}

module.exports = {
  buildSystemPrompt,
  buildUserPayload,
  buildChatRequest,
};

