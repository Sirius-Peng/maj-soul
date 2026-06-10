const test = require('node:test');
const assert = require('node:assert/strict');

const { inferInMatchFromFrame, inferPlayerCountFromFrame } = require('../src/session/frameHeuristics');

function makeSolidBitmap(width, height, rgba) {
  const bitmap = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    bitmap[i * 4 + 0] = rgba[0];
    bitmap[i * 4 + 1] = rgba[1];
    bitmap[i * 4 + 2] = rgba[2];
    bitmap[i * 4 + 3] = rgba[3];
  }
  return bitmap;
}

test('frameHeuristics: invalid in-match threshold falls back to default', () => {
  const original = process.env.MAJSOUL_INMATCH_TOPBAR_LUMA_THRESHOLD;
  process.env.MAJSOUL_INMATCH_TOPBAR_LUMA_THRESHOLD = 'bad-threshold';
  try {
    const bitmap = makeSolidBitmap(100, 100, [90, 90, 90, 255]);
    assert.equal(inferInMatchFromFrame({ bitmap, width: 100, height: 100 }), true);
  } finally {
    if (original === undefined) {
      delete process.env.MAJSOUL_INMATCH_TOPBAR_LUMA_THRESHOLD;
    } else {
      process.env.MAJSOUL_INMATCH_TOPBAR_LUMA_THRESHOLD = original;
    }
  }
});

test('frameHeuristics: invalid 4P threshold falls back to default', () => {
  const original = process.env.MAJSOUL_4P_RIGHTMID_LUMA_THRESHOLD;
  process.env.MAJSOUL_4P_RIGHTMID_LUMA_THRESHOLD = 'bad-threshold';
  try {
    const bitmap = makeSolidBitmap(100, 100, [100, 100, 100, 255]);
    assert.equal(inferPlayerCountFromFrame({ bitmap, width: 100, height: 100 }), 4);
  } finally {
    if (original === undefined) {
      delete process.env.MAJSOUL_4P_RIGHTMID_LUMA_THRESHOLD;
    } else {
      process.env.MAJSOUL_4P_RIGHTMID_LUMA_THRESHOLD = original;
    }
  }
});
