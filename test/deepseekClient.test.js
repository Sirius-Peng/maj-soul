const test = require('node:test');
const assert = require('node:assert/strict');

const { createAdviceClient } = require('../src/advice/deepseekClient');

test('DeepSeek client: parses strict JSON payload', async () => {
  const client = createAdviceClient({
    apiKey: 'test',
    baseUrl: 'https://example.invalid',
    model: 'deepseek-v4flash',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                turnId: 't1',
                recommendedAction: {
                  label: '打 7p',
                  probability: 0.5,
                  confidence: 0.7,
                  reason: '效率',
                  risk: '中',
                },
                alternatives: [],
                summary: 'test',
                modelNotes: { style: 'balanced', inputCompleteness: 'high' },
              }),
            },
          },
        ],
      }),
    }),
  });

  const result = await client.requestAdvice({ turnId: 't1', legalActions: [] });
  assert.equal(result.turnId, 't1');
  assert.equal(result.recommendedAction.label, '打 7p');
});

