precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_cmap;
uniform float u_freqx;
uniform float u_freqy;
uniform float u_seed;
uniform vec2 u_resolution;
uniform float u_uniform;
uniform float u_perlin;
uniform float u_simplex;
uniform float u_gauss;
uniform float u_pink;
uniform float u_fc[3];
uniform int u_blendmode;
uniform int u_blur;
uniform vec3 u_tint;
uniform int u_tintSpace;
uniform float u_master;
uniform int u_cmap_len;


vec3 softLightBlend(vec3 top, vec3 bot, float intensity);
vec3 screenBlend(vec3 top, vec3 bot, float intensity);
vec3 linearBlend(vec3 top, vec3 bot, float intensity);
vec3 overlayBlend(vec3 top, vec3 bot, float intensity);
vec3 darkenBlend(vec3 top, vec3 bot, float intensity);
vec3 differenceBlend(vec3 top, vec3 bot, float intensity);
vec3 hardLightBlend(vec3 top, vec3 bot, float intensity);
vec3 colorBurnBlend(vec3 top, vec3 bot, float intensity);
vec3 lightenBlend(vec3 top, vec3 bot, float intensity);
vec3 perlinNoise2D(vec2 uv, float fadeCoeffs[3], float vecs[4], float seed);
float uniformNoise(float x);
vec2 simplexNoise2D(vec2 p);
float gaussianNoise(vec2 p);
float pinkNoise(vec2 p);
float psrdnoise(vec2 x, vec2 period, float alpha, out vec2 gradient);
vec3 hsv2rgb(vec3 c);
vec3 rgb2hsv(vec3 c);

const int MAX_LOOPS = 10;

void main() {
    vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
    vec2 uvs = uv + uniformNoise(u_seed);
    float xScl = uvs.x * u_freqx;
    float yScl = uvs.y * u_freqy;
    float noiseVal = 0.;
    if (u_uniform > 0.) {
        noiseVal += uniformNoise(uvs.x * uvs.y) * u_uniform;
    }
    float pVecs[4];
    pVecs[0] = 1.;
    pVecs[1] = 0.;
    pVecs[2] = 0.;
    pVecs[3] = 1.;
    if (u_perlin > 0.) {
        vec3 pnVal = perlinNoise2D(
            vec2(xScl, yScl), u_fc, pVecs, u_seed
        );
        noiseVal += pnVal.x * u_perlin * 2.;
    }
    if (u_simplex > 0.) {
        vec2 gradientOut = vec2(0., 0.);  // just scratch space
        float smpnVal = psrdnoise(
            vec2(xScl, yScl),
            vec2(0., 0.),
            0.,
            gradientOut
        );
        noiseVal += smpnVal * u_simplex * 1.3;
    }

    if (u_gauss > 0.) {
        float gnVal = gaussianNoise(vec2(xScl, yScl));
        noiseVal += gnVal * u_gauss;
    }
    if (u_pink > 0.) {
        float pinkVal = pinkNoise(vec2(xScl, yScl));
        noiseVal += pinkVal * u_pink;
    }
    float noiseMax = clamp(u_pink + u_perlin + u_uniform + u_gauss + u_simplex, 0., 1.);
    noiseVal = clamp(noiseVal, 0., 1.);
    float master = max(u_master, noiseMax);
    vec3 noisePx = clamp(vec3(noiseVal, noiseVal, noiseVal), 0., 1.);
    if (u_cmap_len == 0) {
        noisePx *= u_tint;
    } else {
        noisePx = texture2D(u_cmap, vec2(clamp(noiseVal, 0.0, 1.0), 0.5)).rgb;
    }
    vec3 inColor = texture2D(u_image, uv).rgb;
    if (u_tintSpace == 1) {
        inColor = rgb2hsv(inColor);
        noisePx = rgb2hsv(noisePx);
    }

    vec3 blended;
    if (u_blendmode == 0) {
        blended = linearBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 1) {
        blended = screenBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 2) {
        blended = softLightBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 3) {
        blended = hardLightBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 4) {
        blended = differenceBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 5) {
        blended = colorBurnBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 6) {
        blended = darkenBlend(inColor.rgb, noisePx, u_master);
    } else if (u_blendmode == 7) {
        blended = lightenBlend(inColor.rgb, noisePx, u_master);
    } else {
        blended = noisePx;
    }

    if (u_tintSpace == 1) {
        blended = hsv2rgb(blended);
    }
    gl_FragColor = clamp(vec4(blended, texture2D(u_image, uv).a), 0., 1.);
}