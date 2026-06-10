const test = require('node:test');
const assert = require('node:assert/strict');

const { createAdviceCoordinator } = require('../src/advice/adviceCoordinator');

test('AdviceCoordinator: deduplicates same turnId', async () => {
  let calls = 0;
  const coordinator = createAdviceCoordinator({
    client: {
      requestAdvice: async (frame) => {
        calls += 1;
        return {
          turnId: frame.turnId,
          recommendedAction: {
            label: '打 7p',
            probability: 0.5,
            confidence: 0.8,
            reason: '效率',
            risk: '中',
          },
          alternatives: [],
          summary: 'ok',
          modelNotes: {},
        };
      },
    },
    onUpdate: () => {},
  });

  await coordinator.handleDecisionFrame({ turnId: 't1', legalActions: [] });
  await coordinator.handleDecisionFrame({ turnId: 't1', legalActions: [] });
  assert.equal(calls, 1);
});

test('AdviceCoordinator: persists request and result after db is attached later', async () => {
  const calls = [];
  const coordinator = createAdviceCoordinator({
    client: {
      requestAdvice: async () => ({
        recommendedAction: { label: '打 7p', probability: 0.5, confidence: 0.8, reason: '效率', risk: '中' },
        alternatives: [],
        summary: 'ok',
        modelNotes: {},
      }),
    },
    onUpdate: () => {},
  });
  const db = {
    insertAdviceRequest(payload) {
      calls.push(['request', payload]);
      return 42;
    },
    insertAdviceResult(payload) {
      calls.push(['result', payload]);
      return 84;
    },
  };

  coordinator.setDb(db);
  await coordinator.handleDecisionFrame({
    sessionId: 's-1',
    turnId: 't-2',
    model: 'deepseek-v4flash',
    legalActions: [],
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'request');
  assert.equal(calls[1][0], 'result');
  assert.equal(calls[1][1].requestId, 42);
});
