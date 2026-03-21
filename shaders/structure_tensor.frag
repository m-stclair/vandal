#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_texelSize;
uniform vec2 u_resolution;

out vec4 outColor;

#define PI     3.14159265358979

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 texelSize = u_texelSize / u_resolution;


    // Sobel 3x3
    vec3 tl = texture(u_image, uv + vec2(-1,-1) * texelSize).rgb;
    vec3 tc = texture(u_image, uv + vec2( 0,-1) * texelSize).rgb;
    vec3 tr = texture(u_image, uv + vec2( 1,-1) * texelSize).rgb;
    vec3 ml = texture(u_image, uv + vec2(-1, 0) * texelSize).rgb;
    vec3 mr = texture(u_image, uv + vec2( 1, 0) * texelSize).rgb;
    vec3 bl = texture(u_image, uv + vec2(-1, 1) * texelSize).rgb;
    vec3 bc = texture(u_image, uv + vec2( 0, 1) * texelSize).rgb;
    vec3 br = texture(u_image, uv + vec2( 1, 1) * texelSize).rgb;

    vec3 gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
    vec3 gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;

    // Collapse to luminance gradient

    // TODO: compute in LCH
    const vec3 luma = vec3(0.299, 0.587, 0.114);
    float lx = dot(gx, luma);
    float ly = dot(gy, luma);

    // Structure tensor components
    float Jxx = lx * lx;
    float Jxy = lx * ly;
    float Jyy = ly * ly;

    // NOTE: in production you'd blur Jxx/Jxy/Jyy here with a small
    // Gaussian neighborhood to stabilize the orientation estimate.
    // You can do it inline (expensive but avoids a third pass) or
    // accept slightly noisier orientations.

    // Eigendecomposition — gives us dominant edge direction
    float D    = sqrt(max(0.0, (Jxx - Jyy)*(Jxx - Jyy) + 4.0*Jxy*Jxy));
    float lam1 = 0.5 * (Jxx + Jyy + D);
    float lam2 = 0.5 * (Jxx + Jyy - D);

    // Orientation of the dominant eigenvector
    // (perpendicular to the edge, i.e. the gradient direction)
    float angle       = 0.5 * atan(2.0 * Jxy, Jxx - Jyy);
    float angleNorm = (angle + PI * 0.5) / PI; // maps [-π/2, π/2] → [0, 1]
    float anisotropy  = (lam1 - lam2) / (lam1 + lam2 + 1e-6);

    outColor = vec4(angleNorm, anisotropy, 0.0, 1.0);
}