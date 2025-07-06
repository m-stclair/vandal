
float hash(float x, float y, float seed) {
    return fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233)) * seed));
}

float hash(float x, float seed) {
    return fract(sin(x * 12.9898 + 78.223) * seed);
}

// just an alias
float uniformNoise(float x) {
    return fract(sin(x * 12.9898 + 78.233) * 43758.5453);
}

vec2 grad(float ix, float iy, float seed) {
    float h = hash(ix, iy, seed);

    return vec2(cos(h * 6.2831853), sin(h * 6.2831853));
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
    float distance = x - ix;  // Only in 1D
    return gradient * distance;  // No need for a full dot product
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

float perlinNoise1D(float spat, float fadeCoeffs[3], float vec, float seed) {
    float x0 = floor(spat);
    float d = spat - x0;
    float fadeX = fade(d, fadeCoeffs);

    float dot0 = dotGradient(x0, spat, seed);
    float dot1 = dotGradient(x0 + vec, spat, seed);

    return lerp(dot0, dot1, fadeX);
}

vec2 perlinNoise2D(
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



// Box-Muller transform to generate Gaussian noise
float gaussianNoise(vec2 p) {
    float u1 = hash(p.x, p.y);
    float u2 = hash(p.x + 1.0, p.y);
    float z0 = sqrt(-2.0 * log(u1)) * cos(2.0 * 3.14159 * u2);
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


// Simplex Noise 2D function (based on Ken Perlin's implementation)
vec2 simplexNoise2D(vec2 p) {
    const vec2 G = vec2(0.211324865405187, 0.366025403784439);
    vec2 s = floor(p + dot(p, G));  // Correct the grid coordinate calculation
    vec2 d = p - s + dot(s, G);    // Grid offset adjustment
    vec2 i = floor(d);             // Integer part of the offset
    vec2 f = d - i;                // Fractional part of the offset

    // Gradient directions based on simplex
    vec2 g = vec2(i.x + f.x, i.y + f.y);  // This could represent the gradient lookup
    float grad0 = dot(f, vec2(1, 0));  // Gradient computation
    float grad1 = dot(f, vec2(0, 1));  // Same here; you might need to adjust for proper gradient vectors
    return vec2(grad0, grad1);
}
