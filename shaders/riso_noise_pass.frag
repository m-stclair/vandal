#version 300 es

precision mediump float;

// Declared because the render helper normally binds an input texture as u_image.
// This pass does not need to read it.
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_noiseSeed;

out vec4 outColor;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec2 frag = gl_FragCoord.xy;

    // Cheap and intentionally boring. The riso shader needs shared texture,
    // not five independent fbm stacks pretending to be a materials lab.
    vec2 seed = vec2(u_noiseSeed * 17.31, -u_noiseSeed * 9.73);

    float paperFine = noise2(frag * 0.72 + seed);
    float paperSlow = noise2(frag * vec2(0.095, 0.43) - seed * 0.37);
    float paperFiber = paperFine * 0.55 + paperSlow * 0.45;

    float tooth = noise2(frag * 0.95 + vec2(101.0, 37.0) + seed * 0.11);
    float pinholes = noise2(frag * 2.25 + vec2(47.0, 83.0) - seed * 0.07);
    float speckle = hash21(floor(frag * 1.37) + vec2(13.7, 91.1) + seed);

    outColor = vec4(paperFiber, tooth, pinholes, speckle);
}
