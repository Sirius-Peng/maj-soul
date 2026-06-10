const { PNG } = require('pngjs');

function decodePngToRgba(pngBuffer) {
  const img = PNG.sync.read(pngBuffer);
  const bitmap = Buffer.from(img.data);
  return { bitmap, width: img.width, height: img.height };
}

module.exports = {
  decodePngToRgba,
};

