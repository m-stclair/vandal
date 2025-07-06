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

vec2 perlinNoise2D(vec2 uv, float fadeCoeffs[3], float vecs[4], float seed);
float uniformNoise(float x);

void main() {
    vec2 uv = (gl_FragCoord.xy ) / u_resolution;
    if (u_ratedrive > 0.) {
        uv = uv * (1. - u_ratedrive) + sin(uv * u_rate + u_phase * 6.2831853) * u_ratedrive;
    }
    float vecs[4];
    vecs[0] = 1.;
    vecs[1] = 1.;
    vecs[2] = 1.;
    vecs[3] = 1.;
    float fuzzX = u_fuzz * (uniformNoise(uv.x * uv.y) - 0.5);
    float fuzzY = u_fuzz * (uniformNoise(uv.x * uv.y + 0.1) - 0.5);
    uv = vec2(uv.x + fuzzX, uv.y + fuzzY);
    vec2 noiseValue = perlinNoise2D(
        uv * u_freq + u_pitch, u_fc, vecs, u_seed
    ) * 2. - 1.;
    if (u_boundmode == 0) {
        uv = fract(uv + noiseValue * u_depth);
    } else if (u_boundmode == 1) {
        uv = uv + noiseValue *  u_depth;
    } else {
        uv = uv + clamp(noiseValue  * u_depth, 0., 1.);
    }
    gl_FragColor = texture2D(u_input, uv);
}
