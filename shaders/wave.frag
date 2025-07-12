#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_amp;
uniform float u_freq;
uniform float u_phase;
uniform float u_vertical;

out vec4 outColor;

vec2 waveUV(vec2 uv, float amp, float freq, float phase, float vertical) {
    float offset = sin((vertical > 0.5 ? uv.y : uv.x) * freq + phase) * amp;
    if (vertical > 0.5) {
        uv.x += offset;
    } else {
        uv.y += offset;
    }
    return uv;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = texture(u_image, fract(waveUV(uv, u_amp, u_freq, u_phase, u_vertical)));
}