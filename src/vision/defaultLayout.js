function getDefaultLayout() {
  const baseWidth = 1280;
  const baseHeight = 720;

  return {
    baseWidth,
    baseHeight,
    hand: {
      x: Math.round(baseWidth * 0.19),
      y: Math.round(baseHeight * 0.84),
      width: Math.round(baseWidth * 0.62),
      height: Math.round(baseHeight * 0.11),
      slots: 14,
    },
    dora: {
      x: Math.round(baseWidth * 0.42),
      y: Math.round(baseHeight * 0.04),
      width: Math.round(baseWidth * 0.16),
      height: Math.round(baseHeight * 0.055),
      slots: 5,
    },
    rivers: {
      bottom: {
        x: Math.round(baseWidth * 0.33),
        y: Math.round(baseHeight * 0.58),
        width: Math.round(baseWidth * 0.34),
        height: Math.round(baseHeight * 0.14),
        cols: 6,
        rows: 4,
      },
      right: {
        x: Math.round(baseWidth * 0.71),
        y: Math.round(baseHeight * 0.29),
        width: Math.round(baseWidth * 0.13),
        height: Math.round(baseHeight * 0.34),
        cols: 4,
        rows: 6,
      },
      top: {
        x: Math.round(baseWidth * 0.33),
        y: Math.round(baseHeight * 0.22),
        width: Math.round(baseWidth * 0.34),
        height: Math.round(baseHeight * 0.14),
        cols: 6,
        rows: 4,
      },
      left: {
        x: Math.round(baseWidth * 0.16),
        y: Math.round(baseHeight * 0.29),
        width: Math.round(baseWidth * 0.13),
        height: Math.round(baseHeight * 0.34),
        cols: 4,
        rows: 6,
      },
    },
    wallCount: {
      x: Math.round(baseWidth * 0.485),
      y: Math.round(baseHeight * 0.11),
      width: Math.round(baseWidth * 0.055),
      height: Math.round(baseHeight * 0.05),
      digits: 2,
    },
  };
}

module.exports = {
  getDefaultLayout,
};

