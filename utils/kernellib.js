// kernellib.js

/** Generalized kernel generator
 * shapeFn: (x, y, radius) => boolean  (includes point?)
 * options:
 *   radius: size in pixels (for circular kernels, etc.)
 *   spacing: sample spacing (default 1)
 *   maxTaps: max number of taps (optional downsampling)
 *   weightFn: function of (x / radius, y / radius) => number (default 1)
 */
export function makeKernel(shapeFn, {
  radius = 5,
  spacing = 1,
  maxTaps = Infinity,
  weightFn = () => 1
} = {}) {
  const taps = [];
  const weights = [];

  for (let y = -radius; y <= radius; y += spacing) {
    const ny = y / radius;
    for (let x = -radius; x <= radius; x += spacing) {
      const nx = x / radius;
      if (shapeFn(x, y, radius)) {
        taps.push([x, y]);
        weights.push(weightFn(nx, ny));
      }
    }
  }

  if (taps.length > maxTaps) {
    const stride = Math.ceil(taps.length / maxTaps);
    const keep = (arr) => arr.filter((_, i) => i % stride === 0).slice(0, maxTaps);
    return { taps: keep(taps), weights: keep(weights) };
  }

  return { taps, weights };
}

// === Standard shapes ===

export function boxKernel(size, options = {}) {
  return makeKernel(
    () => true,
    { radius: size / 2, ...options }
  );
}

export function circularKernel(radius, options = {}) {
  return makeKernel(
    (x, y, r) => x * x + y * y <= r * r,
    { radius, ...options }
  );
}

export function annularKernel(rInner, rOuter, options = {}) {
  return makeKernel(
    (x, y) => {
      const d2 = x * x + y * y;
      return d2 >= rInner * rInner && d2 <= rOuter * rOuter;
    },
    { radius: rOuter, ...options }
  );
}

// === Utilities ===

export function normalizeWeights(weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => w / sum);
}

export function centerKernel(taps) {
  const n = taps.length;
  const [cx, cy] = taps.reduce(
    ([sx, sy], [x, y]) => [sx + x / n, sy + y / n],
    [0, 0]
  );
  return taps.map(([x, y]) => [x - cx, y - cy]);
}
