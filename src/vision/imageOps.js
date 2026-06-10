function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width, rect.x));
  const y = Math.max(0, Math.min(height, rect.y));
  const w = Math.max(0, Math.min(width - x, rect.width));
  const h = Math.max(0, Math.min(height - y, rect.height));
  return { x, y, width: w, height: h };
}

function cropRgba({ bitmap, width, height, rect }) {
  const r = clampRect(rect, width, height);
  const out = Buffer.alloc(r.width * r.height * 4);
  for (let y = 0; y < r.height; y++) {
    const srcY = r.y + y;
    for (let x = 0; x < r.width; x++) {
      const srcX = r.x + x;
      const si = (srcY * width + srcX) * 4;
      const di = (y * r.width + x) * 4;
      out[di + 0] = bitmap[si + 0];
      out[di + 1] = bitmap[si + 1];
      out[di + 2] = bitmap[si + 2];
      out[di + 3] = bitmap[si + 3];
    }
  }
  return { bitmap: out, width: r.width, height: r.height };
}

function resizeNearestRgba({ bitmap, width, height, outWidth, outHeight }) {
  if (width === outWidth && height === outHeight) {
    return { bitmap, width, height };
  }
  const out = Buffer.alloc(outWidth * outHeight * 4);
  for (let y = 0; y < outHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor((y / outHeight) * height));
    for (let x = 0; x < outWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor((x / outWidth) * width));
      const si = (srcY * width + srcX) * 4;
      const di = (y * outWidth + x) * 4;
      out[di + 0] = bitmap[si + 0];
      out[di + 1] = bitmap[si + 1];
      out[di + 2] = bitmap[si + 2];
      out[di + 3] = bitmap[si + 3];
    }
  }
  return { bitmap: out, width: outWidth, height: outHeight };
}

module.exports = {
  cropRgba,
  resizeNearestRgba,
};

