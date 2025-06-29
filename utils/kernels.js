export function boxKernel(n, spacing = 1) {
    const taps = [];
    const half = Math.floor(n / 2);
    for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
            taps.push([dx * spacing, dy * spacing]);
        }
    }
    return taps;
}


/**
 * Generate a circular kernel with radius `r` (in pixels).
 * Optionally adjust sampling spacing.
 */
export function circularKernel(r, spacing = 1) {
  const taps = [];
  const r2 = r * r;
  const max = Math.ceil(r / spacing);
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const x = dx * spacing;
      const y = dy * spacing;
      if (x * x + y * y <= r2) {
        taps.push([x, y]);
      }
    }
  }
  return taps;
}

/**
 * Generate an annular kernel (ring shape) with inner and outer radius.
 * Both radii in pixels.
 */
export function annularKernel(rInner, rOuter, spacing = 1) {
  const taps = [];
  const r2Min = rInner * rInner;
  const r2Max = rOuter * rOuter;
  const max = Math.ceil(rOuter / spacing);
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const x = dx * spacing;
      const y = dy * spacing;
      const d2 = x * x + y * y;
      if (d2 >= r2Min && d2 <= r2Max) {
        taps.push([x, y]);
      }
    }
  }
  return taps;
}


export function laplacianKernel() {
  return {
    taps: [
      [ 0, -1],
      [-1,  0], [0, 0], [1, 0],
      [ 0,  1],
    ],
    weights: [
       1,
       1, -4, 1,
       1
    ]
  };
}

export function sobelXKernel() {
  return {
    taps: [
      [-1, -1], [ 0, -1], [ 1, -1],
      [-1,  0], [ 0,  0], [ 1,  0],
      [-1,  1], [ 0,  1], [ 1,  1],
    ],
    weights: [
      -1, 0, 1,
      -2, 0, 2,
      -1, 0, 1,
    ]
  };
}

export function sobelYKernel() {
  return {
    taps: [
      [-1, -1], [ 0, -1], [ 1, -1],
      [-1,  0], [ 0,  0], [ 1,  0],
      [-1,  1], [ 0,  1], [ 1,  1],
    ],
    weights: [
      -1, -2, -1,
       0,  0,  0,
       1,  2,  1,
    ]
  };
}

