const { recognizeFrame } = require('../vision/recognizeFrame');

function makeSolidRgba({ width, height, fill }) {
  const buf = Buffer.alloc(width * height * 4);
  const rgba = Array.isArray(fill) ? fill : [0, 0, 0, 255];
  for (let i = 0; i < width * height; i++) {
    buf[i * 4 + 0] = rgba[0] ?? 0;
    buf[i * 4 + 1] = rgba[1] ?? 0;
    buf[i * 4 + 2] = rgba[2] ?? 0;
    buf[i * 4 + 3] = rgba[3] ?? 255;
  }
  return buf;
}

function fillRectRgba(bitmap, width, rect, rgba) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.max(x0, rect.x + rect.width);
  const y1 = Math.max(y0, rect.y + rect.height);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      bitmap[i + 0] = rgba[0] ?? 0;
      bitmap[i + 1] = rgba[1] ?? 0;
      bitmap[i + 2] = rgba[2] ?? 0;
      bitmap[i + 3] = rgba[3] ?? 255;
    }
  }
}

function materializeFrame(frame) {
  const width = Number(frame?.width) || 0;
  const height = Number(frame?.height) || 0;
  if (width <= 0 || height <= 0) return { bitmap: Buffer.alloc(0), width: 0, height: 0 };
  const bitmap = makeSolidRgba({ width, height, fill: frame.fill });
  if (Array.isArray(frame.rects)) {
    for (const r of frame.rects) {
      if (!r?.rect || !Array.isArray(r.rgba)) continue;
      fillRectRgba(bitmap, width, r.rect, r.rgba);
    }
  }
  return { bitmap, width, height };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function diffFirst(expected, actual, basePath) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return { path: basePath, expectedType: 'array', actualType: typeof actual };
    }
    const len = expected.length;
    if (actual.length !== len) {
      return { path: basePath, expectedLength: len, actualLength: actual.length };
    }
    for (let i = 0; i < len; i++) {
      const sub = diffFirst(expected[i], actual[i], `${basePath}[${i}]`);
      if (sub) return sub;
    }
    return null;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      return { path: basePath, expectedType: 'object', actualType: typeof actual };
    }
    for (const k of Object.keys(expected)) {
      const nextPath = basePath ? `${basePath}.${k}` : k;
      const sub = diffFirst(expected[k], actual?.[k], nextPath);
      if (sub) return sub;
    }
    return null;
  }

  if (expected !== actual) {
    return { path: basePath, expected, actual };
  }
  return null;
}

function runBenchCase(c) {
  const startedAt = Date.now();
  try {
    const { bitmap, width, height } = materializeFrame(c.frame);
    const actual = recognizeFrame({
      bitmap,
      width,
      height,
      bank: c.bank,
      layout: c.layout,
    });

    const expected = c.expected ?? {};
    const diff = diffFirst(expected, actual, '');
    const durationMs = Date.now() - startedAt;
    if (diff) {
      return { id: c.id, ok: false, durationMs, expected, actual, diff };
    }
    return { id: c.id, ok: true, durationMs, expected, actual, diff: null };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    return {
      id: c.id,
      ok: false,
      durationMs,
      expected: c.expected ?? {},
      actual: null,
      diff: {
        path: '$error',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

function runBenchCases({ cases }) {
  const startedAt = Date.now();
  const list = Array.isArray(cases) ? cases : [];
  const out = [];
  for (const c of list) out.push(runBenchCase(c));

  const passed = out.filter((x) => x.ok).length;
  const failed = out.length - passed;
  const durationMs = Date.now() - startedAt;

  return {
    ok: failed === 0,
    summary: { total: out.length, passed, failed, durationMs },
    cases: out,
  };
}

module.exports = {
  runBenchCases,
};

