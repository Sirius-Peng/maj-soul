const test = require('node:test');
const assert = require('node:assert/strict');

const { createOpportunityDetector } = require('../src/advice/opportunityDetector');

test('OpportunityDetector: emits turn for action event', () => {
  const detector = createOpportunityDetector({ seat: 0 });
  const frame = detector.consumeEvent({
    sessionId: 's1',
    capturedAt: '2026-06-10T00:00:00.000Z',
    method: '.lq.ActionPrototype',
    actionName: 'ActionDealTile',
    data: {
      seat: 0,
      operation: {
        type: 'discard',
        combinations: ['7p', '3s'],
      },
    },
  });

  assert.ok(frame);
  assert.equal(frame.operationType, 'discard');
  assert.equal(frame.legalActions.length, 2);
});

