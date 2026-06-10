const { cropRgba, resizeNearestRgba } = require('./imageOps');

function meanRgb({ bitmap, width, height, rect }) {
  if (rect.width <= 0 || rect.height <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const cropped = cropRgba({ bitmap, width, height, rect });
  const buf = cropped.bitmap;
  const len = buf.length;
  if (len === 0) return { r: 0, g: 0, b: 0, a: 0 };
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sa = 0;
  let count = 0;
  for (let i = 0; i + 3 < len; i += 8) {
    sr += buf[i + 0];
    sg += buf[i + 1];
    sb += buf[i + 2];
    sa += buf[i + 3];
    count += 1;
  }
  if (count === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: sr / count, g: sg / count, b: sb / count, a: sa / count };
}

function rgbMad(a, b) {
  return (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)) / 3;
}

function isEmptyPatch(mean) {
  return mean.r + mean.g + mean.b <= 10;
}

function matchSolidTemplates({ mean, templates, threshold }) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return { id: 'unknown', score: Infinity, reason: 'no_templates' };
  }
  let best = { id: 'unknown', score: Infinity };
  let second = { id: 'unknown', score: Infinity };
  for (const t of templates) {
    if (!t || typeof t.id !== 'string' || !Array.isArray(t.rgba) || t.rgba.length < 3) continue;
    const score = rgbMad(mean, { r: t.rgba[0], g: t.rgba[1], b: t.rgba[2] });
    if (score < best.score) {
      second = best;
      best = { id: t.id, score };
    } else if (score < second.score) {
      second = { id: t.id, score };
    }
  }
  if (!Number.isFinite(best.score)) return { id: 'unknown', score: Infinity, reason: 'no_templates' };
  if (best.score > threshold) return { id: 'unknown', score: best.score, reason: 'low_confidence' };
  return { id: best.id, score: best.score, reason: null, secondScore: second.score };
}

function recognizeSlotsWithDetails({ bitmap, width, height, rect, slots, templates, threshold }) {
  if (!rect || rect.width <= 0 || rect.height <= 0 || !Number.isFinite(slots) || slots <= 0) return [];
  const details = [];
  const tiles = [];
  const slotW = Math.floor(rect.width / slots);
  for (let i = 0; i < slots; i++) {
    const slotRect = {
      x: rect.x + i * slotW,
      y: rect.y,
      width: i === slots - 1 ? rect.x + rect.width - (rect.x + i * slotW) : slotW,
      height: rect.height,
    };
    const m = meanRgb({ bitmap, width, height, rect: slotRect });
    if (isEmptyPatch(m)) continue;
    const match = matchSolidTemplates({ mean: m, templates, threshold });
    details.push({ tile: match.id, score: match.score, reason: match.reason });
    tiles.push(match.id);
  }
  return { tiles, details };
}

function recognizeRiverGridWithDetails({ bitmap, width, height, rect, cols, rows, templates, threshold }) {
  if (!rect || rect.width <= 0 || rect.height <= 0 || cols <= 0 || rows <= 0) return [];
  const details = [];
  const tiles = [];
  const cellW = Math.floor(rect.width / cols);
  const cellH = Math.floor(rect.height / rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellRect = {
        x: rect.x + c * cellW,
        y: rect.y + r * cellH,
        width: c === cols - 1 ? rect.x + rect.width - (rect.x + c * cellW) : cellW,
        height: r === rows - 1 ? rect.y + rect.height - (rect.y + r * cellH) : cellH,
      };
      const m = meanRgb({ bitmap, width, height, rect: cellRect });
      if (isEmptyPatch(m)) return { tiles, details };
      const match = matchSolidTemplates({ mean: m, templates, threshold });
      details.push({ tile: match.id, score: match.score, reason: match.reason });
      tiles.push(match.id);
    }
  }
  return { tiles, details };
}

function recognizeWallCount({ bitmap, width, height, rect, digits, templates, threshold }) {
  if (!rect || rect.width <= 0 || rect.height <= 0 || digits <= 0) {
    return { value: null, reason: 'no_wallcount_roi' };
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    return { value: null, reason: 'no_templates' };
  }

  const digitW = Math.floor(rect.width / digits);
  let s = '';
  for (let i = 0; i < digits; i++) {
    const digitRect = {
      x: rect.x + i * digitW,
      y: rect.y,
      width: i === digits - 1 ? rect.x + rect.width - (rect.x + i * digitW) : digitW,
      height: rect.height,
    };
    const m = meanRgb({ bitmap, width, height, rect: digitRect });
    if (isEmptyPatch(m)) return { value: null, reason: 'no_wallcount_digits' };
    const match = matchSolidTemplates({ mean: m, templates, threshold });
    if (match.id === 'unknown') return { value: null, reason: 'low_confidence' };
    s += match.id;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return { value: null, reason: 'parse_failed' };
  return { value: n, reason: null };
}

function normalizeToLayout({ bitmap, width, height, layout }) {
  if (!layout || !Number.isFinite(layout.baseWidth) || !Number.isFinite(layout.baseHeight)) {
    return { bitmap, width, height };
  }
  return resizeNearestRgba({
    bitmap,
    width,
    height,
    outWidth: layout.baseWidth,
    outHeight: layout.baseHeight,
  });
}

function recognizeFrame({ bitmap, width, height, bank, layout }) {
  const normalized = normalizeToLayout({ bitmap, width, height, layout });
  const w = normalized.width;
  const h = normalized.height;
  const b = normalized.bitmap;

  const tileThreshold = Number(process.env.MAJSOUL_TILE_MAD_THRESHOLD ?? 25);
  const digitThreshold = Number(process.env.MAJSOUL_DIGIT_MAD_THRESHOLD ?? 25);

  const hand = recognizeSlotsWithDetails({
    bitmap: b,
    width: w,
    height: h,
    rect: layout?.hand ?? null,
    slots: layout?.hand?.slots ?? 0,
    templates: bank?.tiles ?? [],
    threshold: tileThreshold,
  });

  const dora = recognizeSlotsWithDetails({
    bitmap: b,
    width: w,
    height: h,
    rect: layout?.dora ?? null,
    slots: layout?.dora?.slots ?? 0,
    templates: bank?.tiles ?? [],
    threshold: tileThreshold,
  });

  const riverBottom = recognizeRiverGridWithDetails({
      bitmap: b,
      width: w,
      height: h,
      rect: layout?.rivers?.bottom ?? null,
      cols: layout?.rivers?.bottom?.cols ?? 0,
      rows: layout?.rivers?.bottom?.rows ?? 0,
      templates: bank?.tiles ?? [],
      threshold: tileThreshold,
    });
  const riverRight = recognizeRiverGridWithDetails({
      bitmap: b,
      width: w,
      height: h,
      rect: layout?.rivers?.right ?? null,
      cols: layout?.rivers?.right?.cols ?? 0,
      rows: layout?.rivers?.right?.rows ?? 0,
      templates: bank?.tiles ?? [],
      threshold: tileThreshold,
    });
  const riverTop = recognizeRiverGridWithDetails({
      bitmap: b,
      width: w,
      height: h,
      rect: layout?.rivers?.top ?? null,
      cols: layout?.rivers?.top?.cols ?? 0,
      rows: layout?.rivers?.top?.rows ?? 0,
      templates: bank?.tiles ?? [],
      threshold: tileThreshold,
    });
  const riverLeft = recognizeRiverGridWithDetails({
      bitmap: b,
      width: w,
      height: h,
      rect: layout?.rivers?.left ?? null,
      cols: layout?.rivers?.left?.cols ?? 0,
      rows: layout?.rivers?.left?.rows ?? 0,
      templates: bank?.tiles ?? [],
      threshold: tileThreshold,
    });

  const wallCount = recognizeWallCount({
    bitmap: b,
    width: w,
    height: h,
    rect: layout?.wallCount ?? null,
    digits: layout?.wallCount?.digits ?? 0,
    templates: bank?.digits ?? [],
    threshold: digitThreshold,
  });

  return {
    handTiles: hand.tiles ?? [],
    handTileDetails: hand.details ?? [],
    doraIndicators: dora.tiles ?? [],
    doraIndicatorDetails: dora.details ?? [],
    rivers: {
      bottom: riverBottom.tiles ?? [],
      right: riverRight.tiles ?? [],
      top: riverTop.tiles ?? [],
      left: riverLeft.tiles ?? [],
    },
    riverDetails: {
      bottom: riverBottom.details ?? [],
      right: riverRight.details ?? [],
      top: riverTop.details ?? [],
      left: riverLeft.details ?? [],
    },
    remainingWallCount: wallCount.value,
    remainingWallCountReason: wallCount.reason,
    layout: layout ? { baseWidth: layout.baseWidth, baseHeight: layout.baseHeight } : null,
  };
}

module.exports = {
  recognizeFrame,
};
