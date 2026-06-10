const assert = require('node:assert/strict');
const test = require('node:test');

const { PNG } = require('pngjs');

const { decodePngToRgba } = require('../src/vision/pngDecode');

test('decodePngToRgba: decodes png into rgba bitmap', () => {
  const png = new PNG({ width: 2, height: 1 });
  png.data[0] = 1;
  png.data[1] = 2;
  png.data[2] = 3;
  png.data[3] = 255;
  png.data[4] = 10;
  png.data[5] = 20;
  png.data[6] = 30;
  png.data[7] = 128;

  const buf = PNG.sync.write(png);
  const decoded = decodePngToRgba(buf);

  assert.equal(decoded.width, 2);
  assert.equal(decoded.height, 1);
  assert.equal(decoded.bitmap.length, 8);
  assert.deepEqual(Array.from(decoded.bitmap), [1, 2, 3, 255, 10, 20, 30, 128]);
});

