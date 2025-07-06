precision mediump float;

uniform sampler2D u_input;
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

vec3 softLightBlend(vec3 top, vec3 bot);
vec3 screenBlend(vec3 top, vec3 bot);
vec3 linearBlend(vec3 top, vec3 bot);
vec3 overlayBlend(vec3 top, vec3 bot);
vec3 darkenBlend(vec3 top, vec3 bot);
vec3 differenceBlend(vec3 top, vec3 bot);
vec3 hardLightBlend(vec3 top, vec3 bot);
vec3 colorBurnBlend(vec3 top, vec3 bot);
vec2 perlinNoise2D(vec2 uv, float fadeCoeffs[3], float vecs[4], float seed);
float uniformNoise(float x);
vec2 simplexNoise2D(vec2 p);
float gaussianNoise(vec2 p);
float pinkNoise(vec2 p);

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
    pVecs[1] = 1.;
    pVecs[2] = 1.;
    pVecs[3] = 1.;
    if (u_perlin > 0.) {
        float pnoiseVal = 0.;
        for (int i = 0; i <= MAX_LOOPS; i++) {
            if (i > u_blur) break;
            vec2 pn2Val = perlinNoise2D(
                    vec2(
                        yScl + u_freqy * uniformNoise(yScl) * float(i),
                        xScl + u_freqx * uniformNoise(xScl) * float(i)
                    ),
                    u_fc,
                    pVecs,
                    u_seed
            );
            pnoiseVal += (pn2Val.x + pn2Val.y) / 2.;
        }
        noiseVal += pnoiseVal / (float(u_blur) + 1.) * u_perlin;
    }
    if (u_simplex > 0.) {
        float smpnVal = 0.;
        for (int i = 0; i <= MAX_LOOPS; i++) {
            if (i > u_blur) break;
            vec2 smpn2Val = simplexNoise2D(
                vec2(
                    xScl + u_freqx * uniformNoise(xScl) * float(i),
                    yScl + u_freqy * uniformNoise(yScl) * float(i)
                )
            );
            smpnVal += (smpn2Val.x + smpn2Val.y) / 2.;
        }
        noiseVal += smpnVal / (float(u_blur) + 1.) * u_simplex;
    }
    if (u_gauss > 0.) {
        float gnVal = gaussianNoise(vec2(xScl, yScl));
        noiseVal += gnVal * u_gauss;
    }
    if (u_pink > 0.) {
        float pinkVal = pinkNoise(vec2(xScl, yScl));
        noiseVal += pinkVal * u_pink;
    }

    vec4 color = texture2D(u_input, uv);
    vec3 noisePx = vec3(noiseVal, noiseVal, noiseVal);
    if (u_blendmode == 0) {
        gl_FragColor = vec4(linearBlend(noisePx, color.rgb), color.a);
    } else if (u_blendmode == 1) {
        gl_FragColor = vec4(screenBlend(noisePx, color.rgb), color.a);
    } else if (u_blendmode == 2) {
        gl_FragColor = vec4(softLightBlend(noisePx, color.rgb), color.a);
    } else if (u_blendmode == 3) {
        gl_FragColor = vec4(hardLightBlend(noisePx, color.rgb), color.a);
    } else if (u_blendmode == 4) {
        gl_FragColor = vec4(differenceBlend(noisePx, color.rgb), color.a);
    } else if (u_blendmode == 5) {
        gl_FragColor = vec4(colorBurnBlend(noisePx, color.rgb), color.a);
    } else {
        gl_FragColor = vec4(noisePx, color.a);
    }
}