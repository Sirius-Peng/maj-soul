function createAdviceCoordinator({ client, onUpdate = () => {}, db = null }) {
  const completed = new Set();
  let currentTurnId = null;

  async function handleDecisionFrame(frame) {
    if (!frame || !frame.turnId) return null;
    if (completed.has(frame.turnId)) return null;

    currentTurnId = frame.turnId;
    onUpdate({
      type: 'loading',
      turnId: frame.turnId,
      frame,
    });

    const requestId =
      db && typeof db.insertAdviceRequest === 'function'
        ? db.insertAdviceRequest({
            sessionId: frame.sessionId ?? 'unknown',
            turnId: frame.turnId,
            provider: 'deepseek',
            model: frame.model ?? 'deepseek-v4flash',
            requestPayload: frame,
          })
        : null;

    try {
      const result = await client.requestAdvice(frame);
      completed.add(frame.turnId);

      if (db && typeof db.insertAdviceResult === 'function') {
        db.insertAdviceResult({
          sessionId: frame.sessionId ?? 'unknown',
          turnId: frame.turnId,
          requestId,
          status: 'ok',
          result,
        });
      }

      const payload = {
        type: 'ready',
        turnId: frame.turnId,
        frame,
        result,
      };
      if (currentTurnId === frame.turnId) onUpdate(payload);
      return payload;
    } catch (error) {
      const err = {
        message: error instanceof Error ? error.message : String(error),
      };

      if (db && typeof db.insertAdviceResult === 'function') {
        db.insertAdviceResult({
          sessionId: frame.sessionId ?? 'unknown',
          turnId: frame.turnId,
          requestId,
          status: 'error',
          error: err,
        });
      }

      const payload = {
        type: 'error',
        turnId: frame.turnId,
        frame,
        error: err,
      };
      if (currentTurnId === frame.turnId) onUpdate(payload);
      return payload;
    }
  }

  return {
    handleDecisionFrame,
  };
}

module.exports = {
  createAdviceCoordinator,
};

