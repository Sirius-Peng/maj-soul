const assert = require('node:assert/strict');
const test = require('node:test');

const { recognizeFrame, __internals } = require('../src/vision/recognizeFrame');

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

function fillRectRgba(bitmap, width, rect, rgba) {
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * width + x) * 4;
      bitmap[i + 0] = rgba[0];
      bitmap[i + 1] = rgba[1];
      bitmap[i + 2] = rgba[2];
      bitmap[i + 3] = rgba[3];
    }
  }
}

test('recognizeFrame: hand/dora/rivers/remainingWallCount', () => {
  const width = 64;
  const height = 32;
  const bitmap = makeSolidRgba(width, height, [0, 0, 0, 255]);

  const layout = {
    baseWidth: width,
    baseHeight: height,
    hand: { x: 0, y: 0, width: 64, height: 8, slots: 4 },
    dora: { x: 0, y: 8, width: 32, height: 8, slots: 2 },
    rivers: {
      bottom: { x: 0, y: 16, width: 32, height: 16, cols: 2, rows: 2 },
      right: { x: 32, y: 16, width: 32, height: 16, cols: 2, rows: 2 },
      top: { x: 0, y: 16, width: 0, height: 0, cols: 0, rows: 0 },
      left: { x: 0, y: 16, width: 0, height: 0, cols: 0, rows: 0 },
    },
    wallCount: { x: 48, y: 8, width: 16, height: 8, digits: 2 },
  };

  const bank = {
    tiles: [
      { id: 'A', rgba: [200, 0, 0, 255] },
      { id: 'B', rgba: [0, 200, 0, 255] },
    ],
    digits: [
      { id: '1', rgba: [0, 0, 200, 255] },
      { id: '2', rgba: [200, 200, 0, 255] },
    ],
  };

  fillRectRgba(bitmap, width, { x: 0, y: 0, width: 16, height: 8 }, bank.tiles[0].rgba);
  fillRectRgba(bitmap, width, { x: 16, y: 0, width: 16, height: 8 }, bank.tiles[1].rgba);
  fillRectRgba(bitmap, width, { x: 0, y: 8, width: 16, height: 8 }, bank.tiles[1].rgba);
  fillRectRgba(bitmap, width, { x: 16, y: 8, width: 16, height: 8 }, [50, 50, 50, 255]);
  fillRectRgba(bitmap, width, { x: 0, y: 16, width: 16, height: 8 }, bank.tiles[0].rgba);
  fillRectRgba(bitmap, width, { x: 16, y: 16, width: 16, height: 8 }, bank.tiles[1].rgba);
  fillRectRgba(bitmap, width, { x: 32, y: 16, width: 16, height: 8 }, [50, 50, 50, 255]);

  fillRectRgba(bitmap, width, { x: 48, y: 8, width: 8, height: 8 }, bank.digits[0].rgba);
  fillRectRgba(bitmap, width, { x: 56, y: 8, width: 8, height: 8 }, bank.digits[1].rgba);

  const result = recognizeFrame({ bitmap, width, height, bank, layout });

  assert.deepEqual(result.handTiles, ['A', 'B']);
  assert.deepEqual(result.doraIndicators, ['B', 'unknown']);
  assert.deepEqual(result.rivers.bottom, ['A', 'B']);
  assert.deepEqual(result.rivers.right, ['unknown']);
  assert.equal(result.remainingWallCount, 12);
  assert.equal(result.remainingWallCountReason, null);
});

test('recognizeFrame: low confidence wallCount -> null + reason', () => {
  const width = 32;
  const height = 16;
  const bitmap = makeSolidRgba(width, height, [0, 0, 0, 255]);

  const layout = {
    baseWidth: width,
    baseHeight: height,
    hand: { x: 0, y: 0, width: 0, height: 0, slots: 0 },
    dora: { x: 0, y: 0, width: 0, height: 0, slots: 0 },
    rivers: {
      bottom: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
      right: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
      top: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
      left: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
    },
    wallCount: { x: 16, y: 0, width: 16, height: 8, digits: 2 },
  };

  const bank = { tiles: [], digits: [{ id: '1', rgba: [200, 0, 0, 255] }] };
  fillRectRgba(bitmap, width, { x: 16, y: 0, width: 8, height: 8 }, [50, 50, 50, 255]);

  const result = recognizeFrame({ bitmap, width, height, bank, layout });

  assert.equal(result.remainingWallCount, null);
  assert.equal(result.remainingWallCountReason, 'low_confidence');
});

test('recognizeFrame: invalid MAD thresholds fall back to defaults', () => {
  const originalTileThreshold = process.env.MAJSOUL_TILE_MAD_THRESHOLD;
  const originalDigitThreshold = process.env.MAJSOUL_DIGIT_MAD_THRESHOLD;
  process.env.MAJSOUL_TILE_MAD_THRESHOLD = 'not-a-number';
  process.env.MAJSOUL_DIGIT_MAD_THRESHOLD = 'bad';

  try {
    const width = 32;
    const height = 16;
    const bitmap = makeSolidRgba(width, height, [0, 0, 0, 255]);

    const layout = {
      baseWidth: width,
      baseHeight: height,
      hand: { x: 0, y: 0, width: 16, height: 8, slots: 1 },
      dora: { x: 0, y: 0, width: 0, height: 0, slots: 0 },
      rivers: {
        bottom: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
        right: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
        top: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
        left: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
      },
      wallCount: { x: 16, y: 0, width: 16, height: 8, digits: 2 },
    };

    const bank = {
      tiles: [{ id: 'A', rgba: [200, 0, 0, 255] }],
      digits: [{ id: '1', rgba: [200, 0, 0, 255] }],
    };

    fillRectRgba(bitmap, width, { x: 0, y: 0, width: 16, height: 8 }, [80, 80, 80, 255]);
    fillRectRgba(bitmap, width, { x: 16, y: 0, width: 8, height: 8 }, [80, 80, 80, 255]);
    fillRectRgba(bitmap, width, { x: 24, y: 0, width: 8, height: 8 }, [80, 80, 80, 255]);

    const result = recognizeFrame({ bitmap, width, height, bank, layout });

    assert.deepEqual(result.handTiles, ['unknown']);
    assert.equal(result.remainingWallCount, null);
    assert.equal(result.remainingWallCountReason, 'low_confidence');
  } finally {
    if (originalTileThreshold === undefined) {
      delete process.env.MAJSOUL_TILE_MAD_THRESHOLD;
    } else {
      process.env.MAJSOUL_TILE_MAD_THRESHOLD = originalTileThreshold;
    }
    if (originalDigitThreshold === undefined) {
      delete process.env.MAJSOUL_DIGIT_MAD_THRESHOLD;
    } else {
      process.env.MAJSOUL_DIGIT_MAD_THRESHOLD = originalDigitThreshold;
    }
  }
});

test('recognizeFrame internals: invalid slot and river inputs return stable object shapes', () => {
  const emptySlots = __internals.recognizeSlotsWithDetails({
    bitmap: Buffer.alloc(0),
    width: 0,
    height: 0,
    rect: null,
    slots: 0,
    templates: [],
    threshold: 25,
  });
  const emptyRiver = __internals.recognizeRiverGridWithDetails({
    bitmap: Buffer.alloc(0),
    width: 0,
    height: 0,
    rect: null,
    cols: 0,
    rows: 0,
    templates: [],
    threshold: 25,
  });

  assert.deepEqual(emptySlots, { tiles: [], details: [] });
  assert.deepEqual(emptyRiver, { tiles: [], details: [] });
});
