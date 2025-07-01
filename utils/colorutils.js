export function hex2Rgb(hex) {
  hex = hex.replace('#', '');
  const bigint = parseInt(hex, 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255
  ];
}

export function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

export function hsl2Rgb(h, s, l) {
  let r, g, b;

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  if (s === 0) {
    r = g = b = l; // gray
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return [r * 255, g * 255, b * 255];
}

export function rgb2Hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function getLuminance(r, g, b) {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

export function rgb2Lab_A(data) {
  const labData = [];
  for (let i = 0; i < data.length; i += 4) {
    const rgb = [data[i], data[i + 1], data[i + 2]];
    labData.push(...rgb2Lab(...rgb), data[i + 3]);
  }
  return labData
}

export function lab2Rgb_A(data) {
  const rgbData = [];
  for (let i = 0; i < data.length; i += 4) {
    const lab = [data[i], data[i + 1], data[i + 2]];
    rgbData.push(...lab2Rgb(...lab), data[i + 3]);
  }
  return rgbData;
}

export function rgb2Lab(r, g, b) {
  // Convert sRGB to linear RGB
  const srgb = [r, g, b].map(v => v / 255);
  const rgb = srgb.map(v =>
      v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );

  // Linear RGB to XYZ (D65)
  const [rl, gl, bl] = rgb;
  const x = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
  const y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  const z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;

  // Normalize by D65 white point
  const xn = x / 0.95047;
  const yn = y;
  const zn = z / 1.08883;

  const f = t => (t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116);

  const fx = f(xn);
  const fy = f(yn);
  const fz = f(zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b_ = 200 * (fy - fz);

  return [L, a, b_];
}

export function lab2Rgb(L, a, b_) {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b_ / 200;

  const fInv = t =>
      Math.pow(t, 3) > 0.008856 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;

  const x = fInv(fx) * 0.95047;
  const y = fInv(fy);
  const z = fInv(fz) * 1.08883;

  // XYZ to linear RGB
  let rl = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let gl = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

  const toSRGB = c =>
      c <= 0.0031308
          ? 12.92 * c
          : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  // Clamp and scale to [0, 255]
  return [
    Math.min(255, Math.max(0, Math.round(toSRGB(rl) * 255))),
    Math.min(255, Math.max(0, Math.round(toSRGB(gl) * 255))),
    Math.min(255, Math.max(0, Math.round(toSRGB(bl) * 255)))
  ];
}

export function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;

    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (d === 0) {
        h = 0;
    } else {
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return [h, s, v];
}

export function hsvToRgb(h, s, v) {
    let r, g, b;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: [r, g, b] = [v, t, p]; break;
        case 1: [r, g, b] = [q, v, p]; break;
        case 2: [r, g, b] = [p, v, t]; break;
        case 3: [r, g, b] = [p, q, v]; break;
        case 4: [r, g, b] = [t, p, v]; break;
        case 5: [r, g, b] = [v, p, q]; break;
    }

    return [r, g, b];
}