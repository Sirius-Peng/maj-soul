function toLegalActions(operation) {
  if (!operation || typeof operation !== 'object') return [];

  const type = typeof operation.type === 'string' ? operation.type : 'unknown';
  const combinations = Array.isArray(operation.combinations) ? operation.combinations : [];

  if (combinations.length === 0) {
    return [{ type, label: type }];
  }

  return combinations.map((value) => ({
    type,
    label: `${type}:${value}`,
    value,
  }));
}

function createOpportunityDetector({ seat = 0 } = {}) {
  return {
    consumeEvent(event) {
      if (!event || event.method !== '.lq.ActionPrototype') return null;
      const data = event.data && typeof event.data === 'object' ? event.data : null;
      if (!data || data.seat !== seat || !data.operation) return null;

      const operationType =
        typeof data.operation.type === 'string' ? data.operation.type : 'unknown';
      const legalActions = toLegalActions(data.operation);

      return {
        turnId: `${event.sessionId}:${event.capturedAt}:${event.actionName ?? 'unknown'}`,
        sessionId: event.sessionId,
        seat,
        operationType,
        legalActions,
        gameSnapshot: data.snapshot ?? {},
        recentEvents: [],
        uiEvidence: {},
        strategyProfile: 'balanced',
      };
    },
  };
}

module.exports = {
  createOpportunityDetector,
};

