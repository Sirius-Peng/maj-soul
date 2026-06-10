const assert = require('node:assert/strict');
const test = require('node:test');

const { runBenchCases } = require('../src/bench/benchRunner');

test('benchRunner: all cases pass -> ok report', () => {
  const cases = [
    {
      id: 'solid-mini',
      frame: {
        width: 64,
        height: 32,
        fill: [0, 0, 0, 255],
        rects: [
          { rect: { x: 0, y: 0, width: 16, height: 8 }, rgba: [200, 0, 0, 255] },
          { rect: { x: 16, y: 0, width: 16, height: 8 }, rgba: [0, 200, 0, 255] },
        ],
      },
      layout: {
        baseWidth: 64,
        baseHeight: 32,
        hand: { x: 0, y: 0, width: 64, height: 8, slots: 4 },
        dora: { x: 0, y: 0, width: 0, height: 0, slots: 0 },
        rivers: {
          bottom: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          right: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          top: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          left: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
        },
        wallCount: { x: 0, y: 0, width: 0, height: 0, digits: 0 },
      },
      bank: {
        tiles: [
          { id: 'A', rgba: [200, 0, 0, 255] },
          { id: 'B', rgba: [0, 200, 0, 255] },
        ],
        digits: [],
      },
      expected: {
        handTiles: ['A', 'B'],
      },
    },
  ];

  const report = runBenchCases({ cases });

  assert.equal(report.ok, true);
  assert.equal(report.summary.total, 1);
  assert.equal(report.summary.passed, 1);
  assert.equal(report.cases[0].ok, true);
});

test('benchRunner: mismatch -> ok=false + diff info', () => {
  const cases = [
    {
      id: 'solid-mismatch',
      frame: {
        width: 16,
        height: 8,
        fill: [200, 0, 0, 255],
        rects: [],
      },
      layout: {
        baseWidth: 16,
        baseHeight: 8,
        hand: { x: 0, y: 0, width: 16, height: 8, slots: 1 },
        dora: { x: 0, y: 0, width: 0, height: 0, slots: 0 },
        rivers: {
          bottom: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          right: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          top: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
          left: { x: 0, y: 0, width: 0, height: 0, cols: 0, rows: 0 },
        },
        wallCount: { x: 0, y: 0, width: 0, height: 0, digits: 0 },
      },
      bank: { tiles: [{ id: 'A', rgba: [200, 0, 0, 255] }], digits: [] },
      expected: {
        handTiles: ['B'],
      },
    },
  ];

  const report = runBenchCases({ cases });

  assert.equal(report.ok, false);
  assert.equal(report.summary.failed, 1);
  assert.equal(report.cases[0].ok, false);
  assert.ok(typeof report.cases[0].diff === 'object');
  assert.ok(String(report.cases[0].diff.path).startsWith('handTiles'));
});
