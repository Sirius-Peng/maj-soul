const { buildChatRequest } = require('./deepseekPrompt');

function withTimeout(promise, ms) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`advice timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function normalizeAdvicePayload(payload, fallbackTurnId) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('invalid advice payload');
  }

  if (!payload.recommendedAction || typeof payload.recommendedAction !== 'object') {
    throw new Error('missing recommendedAction');
  }

  return {
    turnId: payload.turnId ?? fallbackTurnId,
    recommendedAction: payload.recommendedAction,
    alternatives: Array.isArray(payload.alternatives) ? payload.alternatives : [],
    summary: typeof payload.summary === 'string' ? payload.summary : '',
    modelNotes: payload.modelNotes && typeof payload.modelNotes === 'object' ? payload.modelNotes : {},
  };
}

function createAdviceClient({
  apiKey,
  baseUrl,
  model,
  timeoutMs = 6000,
  strategy = 'balanced',
  fetchImpl = fetch,
}) {
  async function requestAdvice(frame) {
    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured');
    }

    const startedAt = Date.now();
    const response = await withTimeout(
      fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildChatRequest(frame, strategy, model)),
      }),
      timeoutMs,
    );

    if (!response.ok) {
      throw new Error(`deepseek request failed: ${response.status}`);
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('deepseek response content is empty');
    }

    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('deepseek response is not valid JSON');
    }

    const result = normalizeAdvicePayload(parsed, frame.turnId);
    result.latencyMs = Date.now() - startedAt;
    return result;
  }

  return {
    requestAdvice,
  };
}

module.exports = {
  createAdviceClient,
};
