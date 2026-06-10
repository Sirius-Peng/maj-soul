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

