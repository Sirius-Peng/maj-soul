function computeMeanAbsDiffRGBA(prevRgba, nextRgba) {
  const len = Math.min(prevRgba.length, nextRgba.length);
  if (len === 0) return 0;

  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < len; i += 4) {
    sum += Math.abs(prevRgba[i + 0] - nextRgba[i + 0]);
    sum += Math.abs(prevRgba[i + 1] - nextRgba[i + 1]);
    sum += Math.abs(prevRgba[i + 2] - nextRgba[i + 2]);
    count += 3;
  }
  if (count === 0) return 0;
  return sum / count;
}

function shouldMarkKeyframe({ prevRgba, nextRgba, threshold }) {
  const score = computeMeanAbsDiffRGBA(prevRgba, nextRgba);
  return { isKeyframe: score >= threshold, score };
}

module.exports = {
  computeMeanAbsDiffRGBA,
  shouldMarkKeyframe,
};

