function detectMatchTypeFromProbe(probe) {
  const n = probe?.playerCount;
  if (n === 3) return '3P';
  if (n === 4) return '4P';
  return 'unknown';
}

module.exports = {
  detectMatchTypeFromProbe,
};

