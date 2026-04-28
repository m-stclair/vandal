#version 300 es

precision mediump float;

uniform float u_blendamount;
uniform sampler2D u_image;
uniform sampler2D u_offsets;
uniform vec2 u_resolution;
uniform float u_relaxation;

out vec4 outColor;

#if APPROX_INVERSE == 1
    #ifndef INVERSE_APPROX_ITERS
        #error INVERSE_APPROX_ITERS undefined
    #endif
#endif


#include "colorconvert.glsl"
#include "blend.glsl"

vec2 flow(vec2 uv) {
    return texture(u_offsets, fract(uv)).xy;
}

vec2 wrapDelta(vec2 d) {
    return d - round(d);
}

#if APPROX_INVERSE == 1
    vec2 inverseApprox(vec2 uv) {
        vec2 p = fract(uv - flow(uv));

        vec2 prevStep = vec2(0.0);
        float relax = u_relaxation;

        for (int i = 0; i < INVERSE_APPROX_ITERS; i++) {
            vec2 target = fract(uv - flow(p));
            vec2 step = wrapDelta(target - p);
            if (i > 0 && dot(step, prevStep) < 0.0) {
                relax *= 0.5;
            }
            p = fract(p + relax * step);
            prevStep = step;
        }
        return p;
    }
#endif

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if APPROX_INVERSE == 1
    vec2 uvOff = inverseApprox(uv);
#else
    vec2 uvOff = fract(uv + flow(uv));
#endif
    vec3 warpColor = texture(u_image, uvOff).rgb;
    vec3 color = texture(u_image, uv).rgb;
    outColor = vec4(
        blendWithColorSpace(color, warpColor, u_blendamount), 1.0
    );
}
