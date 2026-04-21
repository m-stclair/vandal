#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;


uniform int   u_count;      // number of metaballs, <= MAX_METABALLS
uniform float u_jitter;     // 0 = pure grid, 1 = fully random
uniform float u_size;       // diameter, in grid units
uniform float u_width;      // edge band width, in grid units
uniform float u_softness;   // extra feathering, in grid units
uniform float u_seed;

out vec4 outColor;

#define MAX_METABALLS 256


// deterministic pseudorandom hash
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

// row-major grid placement, then blend toward a fully random position
vec2 metaballPos(float i, float cols, float rows) {
    vec2 gridPos = vec2(
        mod(i, cols),
        floor(i / cols)
    ) + 0.5;

    vec2 randPos = vec2(
        mix(0.5, max(0.5, cols - 0.5), hash21(vec2(i, 17.13 + u_seed))),
        mix(0.5, max(0.5, rows - 0.5), hash21(vec2(i, 91.71 + u_seed)))
    );

    return mix(gridPos, randPos, clamp(u_jitter, 0.0, 1.0));
}

// one blob's contribution:
// 1.0 in the core, then fades across a controllable band.
// summing these and thresholding gives the metaball merge.
float blobField(vec2 p, vec2 c, float radius, float width, float softness) {
    float d = length(p - c);

    float inner = max(0.0, radius - width);
    float outer = radius;

    // widen + feather the edge band
    float e0 = inner - 0.5 * softness;
    float e1 = outer + 0.5 * softness;

    // avoid degenerate smoothstep when width/softness are both zero
    e1 = max(e1, e0 + 1e-4);

    return 1.0 - smoothstep(e0, e1, d);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    float count  = max(float(u_count), 1.0);
    float aspect = u_resolution.x / u_resolution.y;

    // choose cols/rows so cells stay roughly square on screen
    float cols = ceil(sqrt(count * aspect));
    float rows = ceil(count / cols);

    // work in grid-space, so 1.0 = one cell
    vec2 p = vec2(uv.x * cols, uv.y * rows);

    float radius   = 0.5 * max(u_size, 0.0);
    float width    = max(u_width, 0.0);
    float softness = max(u_softness, 0.0);

    float field = 0.0;

    for (int j = 0; j < MAX_METABALLS; ++j) {
        if (j >= u_count) break;

        vec2 c = metaballPos(float(j), cols, rows);
        field += blobField(p, c, radius, width, softness);
    }

    // threshold the summed field into one merged metaball surface
    float aa = max(fwidth(field), 1e-4);
    float alpha = smoothstep(0.5 - aa, 0.5 + aa, field);

    outColor = vec4(vec3(alpha), 1.0);
}