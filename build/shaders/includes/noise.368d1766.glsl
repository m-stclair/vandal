float hash(float x, float y, float seed) {
    return fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233)) * seed));
}

float hash(float x, float seed) {
    return fract(sin(x * 12.9898 + 78.223) * seed);
}

vec2 hash2d_uv(vec2 uv) {
    // Large irrational multipliers reduce grid alignment
    const vec2 k = vec2(127.1, 311.7);
    float n = sin(dot(uv, k)) * 43758.5453;
    return fract(vec2(n, n * 1.2154));
}

float hash12(vec2 p) {
    // Float-domain fallback for legacy callers. Do not use this for
    // screen-space white-noise fields: float hashes form visible lattices
    // on integer pixel grids once the resolution gets large enough.
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

uint mixBits(uint x) {
    x ^= x >> 16;
    x *= 0x7feb352du;
    x ^= x >> 15;
    x *= 0x846ca68bu;
    x ^= x >> 16;
    return x;
}

uint hashPixelBits(vec2 pixel, float seed, uint salt) {
    uvec2 p = uvec2(ivec2(floor(pixel)));
    uint h = floatBitsToUint(seed) ^ salt ^ 0x9e3779b9u;
    h ^= mixBits(p.x + 0x85ebca6bu);
    h = mixBits(h);
    h ^= mixBits(p.y + 0xc2b2ae35u);
    return mixBits(h);
}

float hashPixel(vec2 pixel, float seed, uint salt) {
    // Keep the top 24 bits: exactly representable as a highp float mantissa,
    // so the random value does not pick up precision striping in WebGL.
    return float(hashPixelBits(pixel, seed, salt) >> 8) * (1.0 / 16777216.0);
}

float hash(vec2 p) {
    return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453123);
}


vec2 grad(float ix, float iy, float seed) {
    float h = hash(ix, iy, seed);
    float angle = h * 6.2831853;
    return vec2(cos(angle), sin(angle));
}

float grad(float ix, float seed) {
    float h = hash(ix, seed);
    return cos(h * 6.2831853);
}


float dotGradient(float ix, float iy, float x, float y, float seed) {
    vec2 gradient = grad(ix, iy, seed);
    vec2 distance = vec2(x - ix, y - iy);
    return dot(gradient, distance);
}

float dotGradient(float ix, float x, float seed) {
    float gradient = grad(ix, seed);
    float distance = x - ix;// Only in 1D
    return gradient * distance;// No need for a full dot product
}

vec2 fade(vec2 t, float fc[3]) {
    return t * t * t * (t * (t * fc[0] - fc[1]) + fc[2]);
}

float fade(float t, float fc[3]) {
    return t * t * t * (t * (t * fc[0] - fc[1]) + fc[2]);
}

float lerp(float a, float b, float t) {
    return a + t * (b - a);
}

vec2 perlinBlocks(
    vec2 uv,
    float fadeCoeffs[3],
    float vecs[4],
    float seed
) {
    vec2 x0 = vec2(floor(uv.x), floor(uv.y));
    vec2 dxy = uv - vec2(float(x0.x), float(x0.y));
    vec2 fadeXY = fade(dxy, fadeCoeffs);
    float dot00 = dotGradient(x0.x, x0.y, uv.x, uv.y, seed);
    float dot10 = dotGradient(x0.x + vecs[0], x0.y, uv.x, uv.y, seed);
    float dot01 = dotGradient(x0.x, x0.y + vecs[1], uv.x, uv.y, seed);
    float dot11 = dotGradient(x0.x + vecs[2], x0.y + vecs[3], uv.x, uv.y, seed);

    float interpolatedX0 = lerp(dot00, dot10, fadeXY.x);
    float interpolatedX1 = lerp(dot01, dot11, fadeXY.x);
    float interpolatedX = lerp(interpolatedX0, interpolatedX1, fadeXY.y);

    float interpolatedY0 = lerp(dot00, dot10, fadeXY.y);
    float interpolatedY1 = lerp(dot01, dot11, fadeXY.y);
    float interpolatedY = lerp(interpolatedY0, interpolatedY1, fadeXY.x);

    return vec2(interpolatedX, interpolatedY);
}

vec3 perlinNoise2D(
    vec2 uv,
    float fadeCoeffs[3],
    float vecs[4],
    float seed
) {
    vec2 x0 = vec2(floor(uv.x), floor(uv.y));
    vec2 dxy = uv - vec2(float(x0.x), float(x0.y));
    vec2 fadeXY = fade(dxy, fadeCoeffs);
    float dot00 = dotGradient(x0.x, x0.y, uv.x, uv.y, seed);
    float dot10 = dotGradient(x0.x + vecs[0], x0.y + vecs[1], uv.x, uv.y, seed);
    float dot01 = dotGradient(x0.x + vecs[2], x0.y + vecs[3], uv.x, uv.y, seed);
    float dot11 = dotGradient(x0.x + vecs[0] + vecs[2], x0.y + vecs[1] + vecs[3],
                              uv.x, uv.y, seed);

    float interpolatedX0 = lerp(dot00, dot10, fadeXY.x);
    float interpolatedX1 = lerp(dot01, dot11, fadeXY.x);

    return vec3(
        mix(interpolatedX0, interpolatedX1, fadeXY.y),
        dot10,
        dot01
    );
}

float uniformNoise(vec2 xy) {
    return hash12(xy);
}

float uniformNoise(float x) {
    return hash12(vec2(x, x * 1.61803398875 + 0.137));
}


// Box-Muller transform to generate Gaussian noise
float gaussianNoise(vec2 p) {
    // Use the same sinless hash family as uniform noise. The old sin-dot hash
    // was especially prone to visible bands when brown noise repeatedly sampled
    // nearby normalized coordinates.
    float u1 = max(hash12(p), 1e-6);
    float u2 = hash12(p + vec2(37.17, 91.73));
    float z0 = sqrt(-2.0 * log(u1)) * cos(2.0 * 3.14159265359 * u2);
    return z0;
}


// 1/f noise function (Pink noise)
float pinkNoise(vec2 p) {
    float total = 0.0;
    float persistence = 0.5;
    float frequency = 1.0;
    float amplitude = 1.0;

    for (int i = 0; i < 4; i++) {
        total += gaussianNoise(p * frequency) * amplitude;
        frequency *= 2.0;
        amplitude *= persistence;
    }

    return total;
}

float uniformPixelNoise(vec2 pixel, float seed) {
    return hashPixel(pixel, seed, 0xa24baed5u);
}

float gaussianPixelNoise(vec2 pixel, float seed, uint salt) {
    float u1 = max(hashPixel(pixel, seed, salt), 1e-6);
    float u2 = hashPixel(pixel, seed, salt ^ 0x68bc21ebu);
    return sqrt(-2.0 * log(u1)) * cos(2.0 * 3.14159265359 * u2);
}

float brownPixelNoise(vec2 pixel, float seed) {
    float sum = 0.0;
    float amplitude = 1.0;
    float total = 0.0;

    // Noise Mixer and Dither treat brown as a distribution component, not as a
    // spatial texture field. Use independent salted pixel hashes instead of
    // resampling scaled coordinates, otherwise low octaves become visible clouds
    // or moire.
    for (int i = 0; i < 5; i++) {
        uint salt = 0xb5297a4du + uint(i) * 0x9e3779b9u;
        sum += gaussianPixelNoise(pixel, seed, salt) * amplitude;
        total += amplitude;
        amplitude *= 0.5;
    }
    return sum / total;
}

float brownNoise(vec2 uv) {
    float sum = 0.0;
    float amplitude = 1.0;
    float scale = 1.0;
    float total = 0.0;

    for (int i = 0; i < 5; i++) {
        float octave = float(i);
        vec2 offset = vec2(131.17, 47.73) * (octave + 1.0);
        float n = gaussianNoise(uv * scale + offset);
        sum += n * amplitude;
        total += amplitude;

        scale *= 0.5;
        amplitude *= 2.0;
    }
    return sum / total;
}


// Smoothstep interpolation
float smoothstepInterp(float a, float b, float t) {
    t = t * t * (3.0 - 2.0 * t);
    return mix(a, b, t);
}
//
//float rand(vec2 n) {
//    return fract(sin(dot(n, vec2(41.0, 289.0))) * 43758.5453);
//}

float rand(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// 2D value noise
float valueNoise(vec2 uv) {
    vec2 i = floor(uv);
    vec2 f = fract(uv);

    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));

    float u = smoothstepInterp(a, b, f.x);
    float v = smoothstepInterp(c, d, f.x);
    return smoothstepInterp(u, v, f.y);
}