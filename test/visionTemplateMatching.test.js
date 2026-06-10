const assert = require('node:assert/strict');
const test = require('node:test');

const { pickBestTemplate } = require('../src/vision/templateMatching');

test('pickBestTemplate: picks lowest MAD template', () => {
  const patch = Uint8Array.from([10, 10, 10, 10, 10, 10, 10, 10]);
  const templates = [
    { id: 'a', luma: Uint8Array.from([10, 10, 10, 10, 10, 10, 10, 10]) },
    { id: 'b', luma: Uint8Array.from([50, 50, 50, 50, 50, 50, 50, 50]) },
  ];

  const best = pickBestTemplate({ patchLuma: patch, templates });
  assert.equal(best.bestId, 'a');
  assert.ok(best.bestScore <= best.secondScore);
});

test('pickBestTemplate: empty templates -> unknown + reason', () => {
  const patch = Uint8Array.from([10, 10, 10, 10]);
  const best = pickBestTemplate({ patchLuma: patch, templates: [] });
  assert.equal(best.bestId, 'unknown');
  assert.equal(best.reason, 'no_templates');
});

