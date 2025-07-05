precision mediump float;

uniform sampler2D u_input;
uniform vec2 u_intensity;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform vec2 u_scale;
uniform float u_fc[3];
uniform float u_seed;

vec2 perlinNoise(vec2 uv, float fadeCoeffs[3], float seed);

void main() {
    vec2 uv = (gl_FragCoord.xy ) / u_resolution;
//    gl_FragColor = texture2D(u_input, uv);
//    return;
    vec2 noiseValue = perlinNoise(
        uv * u_scale + u_intensity, u_fc, u_seed
    );

    // Apply displacement ba nb sed on noise, scaled by the offset
    vec2 displacement = noiseValue * u_offset;

    // Fetch the texture color with displacement applied
    gl_FragColor = texture2D(u_input, uv + displacement);
}
