float hash(float x, float y, float seed) {
    return fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233)) * seed));
}

vec2 grad2(float ix, float iy, float seed) {
    float h = hash(ix, iy, seed);

    return vec2(cos(h * 6.2831853), sin(h * 6.2831853));// Using cos and sin to generate a unit vector
}

float dotGridGradient(float ix, float iy, float x, float y, float seed) {
    vec2 gradient = grad2(ix, iy, seed);// Get the random gradient at the grid point
    vec2 distance = vec2(x - ix, y - iy);
    return dot(gradient, distance);
}

vec2 fade(vec2 t, float fc[3]) {
    return t * t * t * (t * (t * fc[0] - fc[1]) + fc[2]);
}

float lerp(float a, float b, float t) {
    return a + t * (b - a);
}

vec2 perlinNoise(vec2 uv, float fadeCoeffs[3], float seed) {
    vec2 x0 = vec2(floor(uv.x), floor(uv.y));

    // Relative x and y coordinates in grid cell
    vec2 dxy = uv - vec2(float(x0.x), float(x0.y));

    // Smooth the coordinates using fade function
    vec2 fadeXY = fade(dxy, fadeCoeffs);

    // Dot products of the gradients (for each axis)
    float dot00 = dotGridGradient(x0.x, x0.y, uv.x, uv.y, seed);
    float dot10 = dotGridGradient(x0.x + 1., x0.y, uv.x, uv.y, seed);
    float dot01 = dotGridGradient(x0.x, x0.y + 1., uv.x, uv.y, seed);
    float dot11 = dotGridGradient(x0.x + 1., x0.y + 1., uv.x, uv.y, seed);

    // Interpolate the results for both x and y axes
    float interpolatedX0 = lerp(dot00, dot10, fadeXY.x);
    float interpolatedX1 = lerp(dot01, dot11, fadeXY.x);
    float interpolatedX = lerp(interpolatedX0, interpolatedX1, fadeXY.y);

    float interpolatedY0 = lerp(dot00, dot10, fadeXY.y);
    float interpolatedY1 = lerp(dot01, dot11, fadeXY.y);
    float interpolatedY = lerp(interpolatedY0, interpolatedY1, fadeXY.x);


    // Return the perlin noise value as a vec2
    return vec2(interpolatedX, interpolatedY);// You can adjust the second value if needed
}
