// requires: colorconvert.glsl

vec3 sobel3x3(sampler2D tex, vec2 uv, vec2 texel) {
    vec3 tl = texture(u_image, uv + vec2(-1,-1) * texel).rgb;
    vec3 tc = texture(u_image, uv + vec2( 0,-1) * texel).rgb;
    vec3 tr = texture(u_image, uv + vec2( 1,-1) * texel).rgb;
    vec3 ml = texture(u_image, uv + vec2(-1, 0) * texel).rgb;
    vec3 mr = texture(u_image, uv + vec2( 1, 0) * texel).rgb;
    vec3 bl = texture(u_image, uv + vec2(-1, 1) * texel).rgb;
    vec3 bc = texture(u_image, uv + vec2( 0, 1) * texel).rgb;
    vec3 br = texture(u_image, uv + vec2( 1, 1) * texel).rgb;

    vec3 gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    vec3 gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;

    // Collapse to luminance gradient
    float lx = luminance(srgb2linear(gx));
    float ly = luminance(srgb2linear(gy));
    return vec3(length(vec2(lx, ly)), lx, ly);
}