precision mediump float;

uniform sampler2D u_input;
uniform vec2 u_pitch;
uniform vec2 u_resolution;
uniform vec2 u_roll;
uniform vec2 u_yaw;
uniform float u_fc[3];
uniform float u_seed;
uniform int u_boundmode;
uniform float u_depth;
uniform float u_rate;
uniform float u_ratedrive;

vec2 perlinNoise2D(vec2 uv, float fadeCoeffs[3], float seed);

void main() {
    vec2 uv = (gl_FragCoord.xy ) / u_resolution;
    if (u_ratedrive > 0.) {
        uv = uv * (1. - u_ratedrive) + sin(uv * u_rate) * u_ratedrive;
    }
    vec2 noiseValue = perlinNoise2D(
        uv * u_yaw + u_pitch, u_fc, u_seed
    );
    vec2 displacement;
    if (u_boundmode == 0) {
        displacement = fract(noiseValue + u_roll);
    } else if (u_boundmode == 1){
        displacement = noiseValue * u_roll;
    } else {
        displacement = clamp(noiseValue * u_roll, 0., 1.);
    }
    displacement *= u_depth;
    gl_FragColor = texture2D(u_input, uv + displacement);
}
