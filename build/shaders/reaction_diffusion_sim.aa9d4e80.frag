#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform sampler2D u_stateTex;
uniform sampler2D u_flowTex;
uniform vec2 u_resolution;

uniform float u_feed;
uniform float u_kill;
uniform float u_diffusionA;
uniform float u_diffusionB;
uniform float u_dt;

uniform float u_seedDensity;
uniform float u_seedMix;
uniform float u_seedScale;
uniform float u_sourceInject;
uniform float u_sourcePower;
uniform float u_advection;
uniform int u_isInit;

out vec4 outColor;

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

vec2 wrapUV(vec2 uv) {
    return fract(uv);
}

vec3 sampleImage(vec2 uv) {
    return texture(u_image, wrapUV(uv)).rgb;
}

vec2 sampleState(vec2 uv) {
    return texture(u_stateTex, wrapUV(uv)).rg;
}

vec2 sampleFlow(vec2 uv) {
    return texture(u_flowTex, wrapUV(uv)).rg;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 src = sampleImage(uv);
    float srcLuma = pow(clamp(luma(src), 0.0, 1.0), max(0.001, u_sourcePower));

    if (u_isInit == 1) {
        float aspect = u_resolution.x / max(u_resolution.y, 1.0);
        vec2 seedGrid = floor(uv * vec2(aspect, 1.0) * max(1.0, u_seedScale));
        float cellNoise = hash21(seedGrid + vec2(17.31, 91.7));
        float seedField = mix(cellNoise, srcLuma, clamp(u_seedMix, 0.0, 1.0));
        float centerBlob = smoothstep(0.22, 0.02, distance(uv, vec2(0.5)));
        float seed = max(step(1.0 - clamp(u_seedDensity, 0.0, 1.0), seedField), centerBlob * 0.85);

        float a = clamp(1.0 - seed * 0.55, 0.0, 1.0);
        float b = clamp(seed * 0.95, 0.0, 1.0);
        outColor = vec4(a, b, srcLuma, 1.0);
        return;
    }

    vec2 texel = 1.0 / u_resolution;
    vec2 flowPx = sampleFlow(uv);
    vec2 baseUV = wrapUV(uv - flowPx * texel * max(0.0, u_advection));

    vec2 c  = sampleState(baseUV);
    vec2 n  = sampleState(baseUV + vec2(0.0, texel.y));
    vec2 s  = sampleState(baseUV - vec2(0.0, texel.y));
    vec2 e  = sampleState(baseUV + vec2(texel.x, 0.0));
    vec2 w  = sampleState(baseUV - vec2(texel.x, 0.0));
    vec2 ne = sampleState(baseUV + texel);
    vec2 nw = sampleState(baseUV + vec2(-texel.x, texel.y));
    vec2 se = sampleState(baseUV + vec2(texel.x, -texel.y));
    vec2 sw = sampleState(baseUV - texel);

    vec2 lap =
        -1.0 * c +
        0.2 * (n + s + e + w) +
        0.05 * (ne + nw + se + sw);

    float a = c.r;
    float b = c.g;
    float reaction = a * b * b;

    float da = u_diffusionA * lap.r - reaction + u_feed * (1.0 - a);
    float db = u_diffusionB * lap.g + reaction - (u_kill + u_feed) * b;

    vec3 advectedSrc = sampleImage(baseUV);
    float advectedLuma = pow(clamp(luma(advectedSrc), 0.0, 1.0), max(0.001, u_sourcePower));
    db += u_sourceInject * (advectedLuma - b);

    a = clamp(a + da * u_dt, 0.0, 1.0);
    b = clamp(b + db * u_dt, 0.0, 1.0);

    outColor = vec4(a, b, advectedLuma, 1.0);
}