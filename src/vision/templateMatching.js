function computeMeanAbsDiff1d(a, b) {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += Math.abs(a[i] - b[i]);
  return sum / len;
}

function pickBestTemplate({ patchLuma, templates }) {
  if (!Array.isArray(templates) || templates.length === 0) {
    return {
      bestId: 'unknown',
      bestScore: Infinity,
      secondScore: Infinity,
      reason: 'no_templates',
    };
  }

  let bestId = 'unknown';
  let bestScore = Infinity;
  let secondScore = Infinity;

  for (const t of templates) {
    if (!t || typeof t.id !== 'string' || !(t.luma instanceof Uint8Array)) continue;
    if (t.luma.length !== patchLuma.length) continue;
    const score = computeMeanAbsDiff1d(patchLuma, t.luma);
    if (score < bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestId = t.id;
    } else if (score < secondScore) {
      secondScore = score;
    }
  }

  if (!Number.isFinite(bestScore)) {
    return {
      bestId: 'unknown',
      bestScore: Infinity,
      secondScore: Infinity,
      reason: 'no_compatible_templates',
    };
  }

  return { bestId, bestScore, secondScore, reason: null };
}

module.exports = {
  computeMeanAbsDiff1d,
  pickBestTemplate,
};

