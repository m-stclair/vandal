const float REF_X = 0.95047;
const float REF_Y = 1.00000;
const float REF_Z = 1.08883;
const float EPSILON = 0.008856;
const float KAPPA = 903.3;

float lab_f(float t) {
    return t > EPSILON ? pow(t, 1.0 / 3.0) : (KAPPA * t + 16.0) / 116.0;
}

float lab_fInv(float t) {
    float t3 = t * t * t;
    return t3 > EPSILON ? t3 : (116.0 * t - 16.0) / KAPPA;
}

vec3 rgb2lab(vec3 rgb) {
    float x = rgb.r * 0.4124564 + rgb.g * 0.3575761 + rgb.b * 0.1804375;
    float y = rgb.r * 0.2126729 + rgb.g * 0.7151522 + rgb.b * 0.0721750;
    float z = rgb.r * 0.0193339 + rgb.g * 0.1191920 + rgb.b * 0.9503041;

    float fx = lab_f(x / REF_X);
    float fy = lab_f(y / REF_Y);
    float fz = lab_f(z / REF_Z);

    float L = 116.0 * fy - 16.0;
    float a = 500.0 * (fx - fy);
    float b = 200.0 * (fy - fz);

    return vec3(L, a, b);
}

vec3 lab2rgb(vec3 lab) {
    float fy = (lab.x + 16.0) / 116.0;
    float fx = fy + lab.y / 500.0;
    float fz = fy - lab.z / 200.0;

    float x = REF_X * lab_fInv(fx);
    float y = REF_Y * lab_fInv(fy);
    float z = REF_Z * lab_fInv(fz);

    float r = x *  3.2404542 + y * -1.5371385 + z * -0.4985314;
    float g = x * -0.9692660 + y *  1.8760108 + z *  0.0415560;
    float b = x *  0.0556434 + y * -0.2040259 + z *  1.0572252;

    return clamp(vec3(r, g, b), 0.0, 1.0);
}


vec3 rgb2hsv(vec3 c) {
    float Cmax = max(max(c.r, c.g), c.b);
    float Cmin = min(min(c.r, c.g), c.b);
    float delta = Cmax - Cmin;

    float h = 0.0;
    if (delta > 0.00001) {
        if (Cmax == c.r) {
            h = mod((c.g - c.b) / delta, 6.0);
        } else if (Cmax == c.g) {
            h = ((c.b - c.r) / delta) + 2.0;
        } else {
            h = ((c.r - c.g) / delta) + 4.0;
        }
        h /= 6.0;
    }

    float s = Cmax == 0.0 ? 0.0 : delta / Cmax;
    float v = Cmax;

    return vec3(h, s, v);
}

vec3 hsv2rgb(vec3 c) {
    float h = fract(c.x) * 6.0;
    float s = c.y;
    float v = c.z;

    float i = floor(h);
    float f = h - i;

    float p = v * (1.0 - s);
    float q = v * (1.0 - s * f);
    float t = v * (1.0 - s * (1.0 - f));

    if (i == 0.0) return vec3(v, t, p);
    if (i == 1.0) return vec3(q, v, p);
    if (i == 2.0) return vec3(p, v, t);
    if (i == 3.0) return vec3(p, q, v);
    if (i == 4.0) return vec3(t, p, v);
    return vec3(v, p, q); // i == 5.0
}


vec3 hsl2rgb(vec3 c) {
    float h = c.x, s = c.y, l = c.z;

    float a = s * min(l, 1.0 - l);
    vec3 k = vec3(0.0, 2.0/3.0, 1.0/3.0);
    vec3 p = abs(fract(h + k) * 6.0 - 3.0);
    return l - a + a * clamp(p - 1.0, 0.0, 1.0);
}

vec3 rgb2hsl(vec3 c) {
    float maxc = max(max(c.r, c.g), c.b);
    float minc = min(min(c.r, c.g), c.b);
    float delta = maxc - minc;

    float l = 0.5 * (maxc + minc);

    float s = delta / (1.0 - abs(2.0 * l - 1.0) + 1e-10);

    float h = 0.0;
    if (delta > 1e-10) {
        vec3 n = (c - minc) / delta;
        h = (c.r >= maxc) ? (n.g - n.b) :
            (c.g >= maxc) ? (2.0 + n.b - n.r) :
                            (4.0 + n.r - n.g);
        h = fract(h / 6.0);
    }

    return vec3(h, s, l);
}


vec3 rgb2lch(vec3 rgb) {
    vec3 lab = rgb2lab(rgb);
    float L = lab.x;
    float a = lab.y;
    float b = lab.z;

    float C = length(lab.yz);         // chroma
    float h = atan(b, a);             // hue angle, radians
    if (h < 0.0) h += 2.0 * 3.14159265;

    return vec3(L, C, h);
}

vec3 lch2rgb(vec3 lch) {
    float L = lch.x;
    float C = lch.y;
    float h = lch.z;

    float a = cos(h) * C;
    float b = sin(h) * C;

    return lab2rgb(vec3(L, a, b));
}

vec3 rgb2opponent(vec3 rgb) {
    float o1 = (rgb.r + rgb.g + rgb.b) / 3.0;                  // intensity
    float o2 = (rgb.r - rgb.g) / sqrt(2.0);                    // red vs green
    float o3 = (rgb.r + rgb.g - 2.0 * rgb.b) / sqrt(6.0);      // yellow vs blue
    return vec3(o1, o2, o3);
}

vec3 opponent2rgb(vec3 opp) {
    float o1 = opp.x;
    float o2 = opp.y;
    float o3 = opp.z;
    float r = o1 + o2 / sqrt(2.0) + o3 / sqrt(6.0);
    float g = o1 - o2 / sqrt(2.0) + o3 / sqrt(6.0);
    float b = o1 - 2.0 * o3 / sqrt(6.0);
    return vec3(r, g, b);
}


vec3 rgb2ycbcr(vec3 rgb) {
    float y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float cb = -0.169 * rgb.r - 0.331 * rgb.g + 0.500 * rgb.b + 0.5;
    float cr =  0.500 * rgb.r - 0.419 * rgb.g - 0.081 * rgb.b + 0.5;
    return vec3(y, cb, cr);
}

vec3 ycbcr2rgb(vec3 ycbcr) {
    float y  = ycbcr.x;
    float cb = ycbcr.y - 0.5;
    float cr = ycbcr.z - 0.5;
    float r = y + 1.402 * cr;
    float g = y - 0.344136 * cb - 0.714136 * cr;
    float b = y + 1.772 * cb;
    return vec3(r, g, b);
}


vec3 srgb2linear(vec3 c) {
    return pow(c, vec3(2.2));
}

vec3 linear2srgb(vec3 c) {
    return pow(c, vec3(1.0 / 2.2));
}

// These constants are approximations for D65 Lab/LCH in sRGB (2° observer)
// L ∈ [0, 100], a ∈ [-128, 127], b ∈ [-128, 127]
// C ∈ [0, ~150], h ∈ [0, 360]
vec3 normalizeLab(vec3 lab) {
    return vec3(lab.x / 100.0, (lab.y + 128.0) / 255.0, (lab.z + 128.0) / 255.0);
}
vec3 denormalizeLab(vec3 labn) {
    return vec3(labn.x * 100.0, labn.y * 255.0 - 128.0, labn.z * 255.0 - 128.0);
}
vec3 normalizeLCH(vec3 lch) {
    return vec3(lch.x / 100.0, lch.y / 150.0, lch.z / 6.2832);
}
vec3 denormalizeLCH(vec3 lchn) {
    return vec3(lchn.x * 100.0, lchn.y * 150.0, lchn.z * 6.2832);
}

vec3 srgb2NormLab(vec3 srgb) {
    return normalizeLab(rgb2lab(srgb2linear(srgb)));
}
vec3 normLab2SRGB(vec3 lab) {
    return linear2srgb(lab2rgb(denormalizeLab(lab)));
}

vec3 srgb2NormLCH(vec3 srgb) {
    return normalizeLCH(rgb2lch(srgb2linear(srgb)));
}
vec3 normLCH2SRGB(vec3 lch) {
    return linear2srgb(lch2rgb(denormalizeLCH(lch)));
}

vec3 srgb2Opponent(vec3 srgb) {
    return rgb2opponent(srgb2linear(srgb));
}
vec3 opponent2SRGB(vec3 opponent) {
    return linear2srgb(opponent2rgb(opponent));
}

vec3 srgb2HSL(vec3 srgb) {
    return rgb2hsl(srgb2linear(srgb));
}

vec3 hsl2SRGB(vec3 hsl) {
    return linear2srgb(hsl2rgb(hsl));
}

float luminance(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
}

#define COLORSPACE_RGB 0
#define COLORSPACE_LAB 1
#define COLORSPACE_LCH 2
#define COLORSPACE_HSV 3
#define COLORSPACE_OPPONENT 4
#define COLORSPACE_YCBCR 5
#define COLORSPACE_HSL 6

#ifndef COLORSPACE
#define COLORSPACE COLORSPACE_RGB
#endif

#ifndef APPLY_CHROMA_BOOST
#define APPLY_CHROMA_BOOST 0
#endif

#if APPLY_CHROMA_BOOST == 1
uniform float u_chromaBoost;

vec3 applyChromaBoost(vec3 c) {
#if COLORSPACE == COLORSPACE_LCH
    c.y *= pow(c.y, 0.2) * u_chromaBoost;
    return c;
#elif COLORSPACE == COLORSPACE_LAB
    float chroma = length(c.yz); // a and b
    vec2 chromaVec = normalize(c.yz);
    chroma = pow(chroma, 0.8) * u_chromaBoost;
    return vec3(c.x, chroma * chromaVec);
#else
    return c;
#endif
}
#endif


vec3 extractColor(vec3 srgb) {
    vec3 extracted;
#if COLORSPACE == COLORSPACE_RGB
    extracted = srgb;
#elif COLORSPACE == COLORSPACE_LAB
    extracted = srgb2NormLab(srgb);
#elif COLORSPACE == COLORSPACE_HSV
    extracted = rgb2hsv(srgb);
#elif COLORSPACE == COLORSPACE_LCH
    extracted = srgb2NormLCH(srgb);
#elif COLORSPACE == COLORSPACE_OPPONENT
    extracted = srgb2Opponent(srgb);
#elif COLORSPACE == COLORSPACE_YCBCR
    extracted = rgb2ycbcr(srgb);
#elif COLORSPACE == COLORSPACE_HSL
    extracted = srgb2HSL(srgb);
#else
    extracted = srgb;
#endif

#if APPLY_CHROMA_BOOST == 1
    extracted = applyChromaBoost(extracted);
#endif
    return extracted;
}

vec3 encodeColor(vec3 color) {
    vec3 encoded;
#if COLORSPACE == COLORSPACE_RGB
    encoded = color;
#elif COLORSPACE == COLORSPACE_LAB
    encoded = normLab2SRGB(color);
#elif COLORSPACE == COLORSPACE_HSV
    encoded = hsv2rgb(color);
#elif COLORSPACE == COLORSPACE_LCH
    encoded = normLCH2SRGB(color);
#elif COLORSPACE == COLORSPACE_OPPONENT
    encoded = opponent2SRGB(color);
#elif COLORSPACE == COLORSPACE_YCBCR
    encoded = ycbcr2rgb(color);
#elif COLORSPACE == COLORSPACE_HSL
    encoded = hsl2SRGB(color);
#else
    encoded = color;
#endif
    return encoded;
}

vec3 computeColorHeat(vec3 inColor) {
    // Derivative magnitude
    vec3 dx = dFdx(inColor);
    vec3 dy = dFdy(inColor);
    float derivMag = length(dx) + length(dy);
    float edge = smoothstep(0.05, 0.2, derivMag);

    // Clipping strength
    float over = max(0.0, max(inColor.r - 1.0, max(inColor.g - 1.0, inColor.b - 1.0)));
    float under = max(0.0, max(-inColor.r, max(-inColor.g, -inColor.b)));
    float clip = smoothstep(0.0, 0.1, clamp(over + under, 0.0, 1.0));

    // Combine: red-yellow-white spectrum
    float alert = max(edge, clip);
    return mix(inColor, vec3(1.0, 1.0 - alert, 1.0 - alert), alert);
}
