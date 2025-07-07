precision mediump float;

uniform sampler2D u_input;
uniform vec2 u_pitch;
uniform vec2 u_resolution;
uniform vec2 u_freq;
uniform float u_fc[3];
uniform float u_seed;
uniform int u_boundmode;
uniform float u_depth;
uniform float u_rate;
uniform float u_ratedrive;
uniform vec2 u_phase;
uniform float u_fuzz;
uniform int u_noisemode;
uniform float u_gradient[4];

vec3 perlinNoise2D(vec2 uv, float fadeCoeffs[3], float vecs[4], float seed);
float uniformNoise(float x);

void main() {
    vec2 uv = (gl_FragCoord.xy) / u_resolution;
    if (u_ratedrive > 0.) {
        uv = uv * (1. - u_ratedrive) + sin(uv * u_rate + u_phase * 6.2831853) * u_ratedrive;
    }
    float fuzzX = u_fuzz * (uniformNoise(uv.x * uv.y) - 0.5);
    float fuzzY = u_fuzz * (uniformNoise(uv.x * uv.y + 0.1) - 0.5);
    uv = vec2(uv.x + fuzzX, uv.y + fuzzY);
    vec3 noiseOut = perlinNoise2D(
        u_freq * (uv + u_pitch), u_fc, u_gradient, u_seed
    ) * 2. - 1.;
    if (u_boundmode == 2) {
        noiseOut = clamp(noiseOut, -1., 1.);
    }
    if (u_noisemode == 0) {
        uv += noiseOut.x * u_depth;
    } else {
        uv += (noiseOut.y + noiseOut.z) / 2. * u_depth;
    }
    if (u_boundmode == 0) {
        uv = fract(uv);
    }
    gl_FragColor = texture2D(u_input, uv);
}
