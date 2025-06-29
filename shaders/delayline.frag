precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

const int MAX_TAPS = 256;
uniform int u_numTaps;
uniform vec2 u_offsets[MAX_TAPS];
uniform float u_weights[MAX_TAPS];

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec4 acc = vec4(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < MAX_TAPS; i++) {
        if (i >= u_numTaps) break;

        vec2 offset = floor(u_offsets[i]) / u_resolution;
        vec4 samp = texture2D(u_texture, uv + offset);
        float w = u_weights[i];
        acc += samp * w;
        totalWeight += w;
    }

    gl_FragColor = totalWeight > 0.0 ? acc / totalWeight : vec4(0.0);
}
