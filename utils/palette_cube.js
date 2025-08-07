const TAU = 6.28318530718;

function isFiniteFloat(x) {
  return Math.abs(x) < 1e20;
}

function hueAngle([a, b]) {
  return Math.atan2(b, a);
}

function getChroma([a, b]) {
  return Math.hypot(a, b);
}

function angleDiff(a1, a2) {
  const d = Math.abs(a1 - a2);
  return Math.min(d, TAU - d);
}

function deltaE_withBias(lab1, lab2, lumaW, chromaW, hueW) {
  const dJ = lab1[0] - lab2[0];
  const C1 = getChroma([lab1[1], lab1[2]]);
  const C2 = getChroma([lab2[1], lab2[2]]);
  const dC = C1 - C2;

  const dH = angleDiff(hueAngle([lab1[1], lab1[2]]), hueAngle([lab2[1], lab2[2]]));
  const avgC = 0.5 * (C1 + C2);
  const hueBias = avgC * dH;

  return (
    lumaW   * Math.abs(dJ) +
    chromaW * Math.abs(dC) +
    hueW    * Math.abs(hueBias)
  );
}

function softAssign(labColor, {
  paletteColors,      // array of [r,g,b]
  paletteSize,
  cycleOffset = 0,
  blendK = 4,
  softness = 1,
  lumaWeight = 1,
  chromaWeight = 1,
  hueWeight = 1
}) {
  const dist = new Array(paletteSize);
  const index = new Array(paletteSize);

  for (let i = 0; i < paletteSize; ++i) {
    dist[i] = deltaE_withBias(labColor, paletteColors[i], lumaWeight, chromaWeight, hueWeight);
    index[i] = i;
  }

  // Partial bubble sort top K
  for (let i = 0; i < blendK; ++i) {
    for (let j = i + 1; j < paletteSize; ++j) {
      if (dist[j] < dist[i]) {
        [dist[i], dist[j]] = [dist[j], dist[i]];
        [index[i], index[j]] = [index[j], index[i]];
      }
    }
  }

  // Weighted blend
  let result = [0, 0, 0];
  let totalWeight = 0;
  for (let i = 0; i < blendK; ++i) {
    const w = 1.0 / Math.pow(dist[i] + 1e-5, softness);
    const color = paletteColors[(index[i] + cycleOffset) % paletteSize];
    result[0] += w * color[0];
    result[1] += w * color[1];
    result[2] += w * color[2];
    totalWeight += w;
  }

  return result.map(c => c / totalWeight);
}

function matchNearest(labColor, {
  paletteColors,
  paletteSize,
  cycleOffset = 0,
  lumaWeight = 1,
  chromaWeight = 1,
  hueWeight = 1
}) {
  let minDist = 1e6;
  let bestIndex = 0;

  for (let i = 0; i < paletteSize; ++i) {
    const d = deltaE_withBias(labColor, paletteColors[i], lumaWeight, chromaWeight, hueWeight);
    if (d < minDist) {
      minDist = d;
      bestIndex = i;
    }
  }

  return paletteColors[(bestIndex + cycleOffset) % paletteSize];
}

function generateLabLUT({
  resolution = 33,
  method = "nearest",
  paletteColors,
  paletteSize,
  cycleOffset = 0,
  softness = 1,
  lumaWeight = 1,
  chromaWeight = 1,
  hueWeight = 1,
}) {

  const assignFn = method === "nearest" ? matchNearest : softAssign;
  const lut = new Float32Array(resolution ** 3 * 3); // RGB triplets

  const Lrange = [0, 100];
  const arange = [-80, 80];
  const brange = [-80, 80];

  const idx = (x, y, z) => 3 * (x * resolution * resolution + y * resolution + z);

  for (let i = 0; i < resolution; ++i) {
    const L = Lrange[0] + (Lrange[1] - Lrange[0]) * (i / (resolution - 1));
    for (let j = 0; j < resolution; ++j) {
      const a = arange[0] + (arange[1] - arange[0]) * (j / (resolution - 1));
      for (let k = 0; k < resolution; ++k) {
        const b = brange[0] + (brange[1] - brange[0]) * (k / (resolution - 1));
        const lab = [L, a, b];

        const rgb = assignFn(lab, {
          paletteColors,
          paletteSize,
          cycleOffset,
          softness,
          lumaWeight,
          chromaWeight,
          hueWeight,
        });

        const ptr = idx(i, j, k);
        lut[ptr] = rgb[0];
        lut[ptr + 1] = rgb[1];
        lut[ptr + 2] = rgb[2];
      }
    }
  }

  return {
    data: lut,
    resolution,
    bounds: { L: Lrange, a: arange, b: brange },
  };
}
