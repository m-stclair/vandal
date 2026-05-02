#version 300 es
precision mediump float;

#ifndef KERNEL_WIDTH
    #error undefined KERNEL_WIDTH
#endif

#ifndef KERNEL_HEIGHT
    #error undefined KERNEL_HEIGHT
#endif

const int KERNEL_SIZE = KERNEL_WIDTH * KERNEL_HEIGHT;

uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform float u_kernel[KERNEL_SIZE];
uniform float u_threshold;
uniform float u_strength;
uniform float u_knee;

out vec4 outColor;

float softLightBlend(float base, float fx) {
    float blended = mix(
        2.0 * base * fx + base * base * (1.0 - 2.0 * fx),
        sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx),
        step(0.5, fx)
    );
    return clamp(blended, 0., 1.);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texel = 1.0 / u_resolution;

    float accumL = 0.0;
    int k = 0;

    int halfWidth = KERNEL_WIDTH / 2;
    int halfHeight = KERNEL_HEIGHT / 2;

    for (int y = 0; y < KERNEL_HEIGHT; y++) {
        for (int x = 0; x < KERNEL_WIDTH; x++) {
            vec2 offset = vec2(float(x - halfWidth), float(y - halfHeight)) * texel;
            // u_image is always in Lab or JzAzBz. so first channel is luminance
            float samp = texture(u_image, uv + offset).x;
            accumL += samp * u_kernel[k];
            k++;
        }
    }

    vec4 pix = texture(u_image, uv);
    vec3 baseColor = pix.rgb;

    float lumaDiff = baseColor.x - accumL;
    float thresh = smoothstep(u_threshold - u_knee, u_threshold + u_knee, abs(lumaDiff));
    float shaped = sign(lumaDiff) * thresh * tanh(abs(lumaDiff));
    float lumaSharp = clamp(baseColor.x + u_strength * shaped, 0.0, 1.0);
    vec3 sharpColor = vec3(softLightBlend(baseColor.x, lumaSharp), baseColor.y, baseColor.z);
    outColor = vec4(sharpColor, pix.a);
}
