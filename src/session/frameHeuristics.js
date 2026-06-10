function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width, rect.x));
  const y = Math.max(0, Math.min(height, rect.y));
  const w = Math.max(0, Math.min(width - x, rect.width));
  const h = Math.max(0, Math.min(height - y, rect.height));
  return { x, y, width: w, height: h };
}

function computeMeanLuma(bitmap, width, height, rect) {
  const r = clampRect(rect, width, height);
  if (r.width === 0 || r.height === 0) return 0;

  let sum = 0;
  let count = 0;
  for (let y = r.y; y < r.y + r.height; y += 2) {
    for (let x = r.x; x < r.x + r.width; x += 2) {
      const i = (y * width + x) * 4;
      const rr = bitmap[i + 0];
      const gg = bitmap[i + 1];
      const bb = bitmap[i + 2];
      sum += 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
      count += 1;
    }
  }
  if (count === 0) return 0;
  return sum / count;
}

function normalizeThreshold(rawValue, fallback) {
  const threshold = Number(rawValue ?? fallback);
  return Number.isFinite(threshold) ? threshold : fallback;
}

function inferInMatchFromFrame({ bitmap, width, height }) {
  if (!bitmap || width <= 0 || height <= 0) return undefined;

  const topBar = computeMeanLuma(bitmap, width, height, {
    x: Math.floor(width * 0.25),
    y: 0,
    width: Math.floor(width * 0.5),
    height: Math.max(20, Math.floor(height * 0.06)),
  });

  const threshold = normalizeThreshold(process.env.MAJSOUL_INMATCH_TOPBAR_LUMA_THRESHOLD, 105);
  return topBar < threshold;
}

function inferPlayerCountFromFrame({ bitmap, width, height }) {
  if (!bitmap || width <= 0 || height <= 0) return undefined;

  const rightMid = computeMeanLuma(bitmap, width, height, {
    x: Math.floor(width * 0.78),
    y: Math.floor(height * 0.35),
    width: Math.floor(width * 0.2),
    height: Math.floor(height * 0.22),
  });

  const threshold = normalizeThreshold(process.env.MAJSOUL_4P_RIGHTMID_LUMA_THRESHOLD, 120);
  return rightMid < threshold ? 4 : 3;
}

module.exports = {
  inferInMatchFromFrame,
  inferPlayerCountFromFrame,
};
