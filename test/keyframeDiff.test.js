const assert = require('node:assert/strict');
const test = require('node:test');

const { computeMeanAbsDiffRGBA, shouldMarkKeyframe } = require('../src/capture/keyframeDiff');

function makeSolidRgba(width, height, rgba) {
  const buf = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    buf[i * 4 + 0] = rgba[0];
    buf[i * 4 + 1] = rgba[1];
    buf[i * 4 + 2] = rgba[2];
    buf[i * 4 + 3] = rgba[3];
  }
  return buf;
}

test('computeMeanAbsDiffRGBA: identical buffers -> 0', () => {
  const a = makeSolidRgba(4, 4, [0, 0, 0, 255]);
  const b = makeSolidRgba(4, 4, [0, 0, 0, 255]);
  assert.equal(computeMeanAbsDiffRGBA(a, b), 0);
});

test('computeMeanAbsDiffRGBA: detects color differences', () => {
  const a = makeSolidRgba(4, 4, [0, 0, 0, 255]);
  const b = makeSolidRgba(4, 4, [255, 0, 0, 255]);
  assert.ok(computeMeanAbsDiffRGBA(a, b) > 0);
});

test('shouldMarkKeyframe: threshold gating', () => {
  const prev = makeSolidRgba(4, 4, [0, 0, 0, 255]);
  const nextSmall = makeSolidRgba(4, 4, [10, 0, 0, 255]);
  const nextBig = makeSolidRgba(4, 4, [255, 0, 0, 255]);

  assert.deepEqual(shouldMarkKeyframe({ prevRgba: prev, nextRgba: nextSmall, threshold: 20 }), {
    isKeyframe: false,
    score: computeMeanAbsDiffRGBA(prev, nextSmall),
  });

  const big = shouldMarkKeyframe({ prevRgba: prev, nextRgba: nextBig, threshold: 20 });
  assert.equal(big.isKeyframe, true);
  assert.ok(big.score >= 20);
});

