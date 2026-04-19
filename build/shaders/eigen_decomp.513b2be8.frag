#version 300 es

precision mediump float;

uniform sampler2D u_structureTensorComponents;
uniform vec2 u_texelSize;
uniform vec2 u_resolution;

out vec4 outColor;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec3 JxxJxyJyy = texture(u_structureTensorComponents, uv).xyz;
    float Jxx = JxxJxyJyy.x;
    float Jxy = JxxJxyJyy.y;
    float Jyy = JxxJxyJyy.z;

    // Eigendecomposition — gives us dominant edge direction
    float D    = sqrt(max(0.0, (Jxx - Jyy)*(Jxx - Jyy) + 4.0*Jxy*Jxy));
    float lam1 = 0.5 * (Jxx + Jyy + D);
    float lam2 = 0.5 * (Jxx + Jyy - D);

    // Orientation of the dominant eigenvector
    // (perpendicular to the edge, i.e. the gradient direction)
    float angle       = 0.5 * atan(2.0 * Jxy, Jxx - Jyy);
    float anisotropy  = (lam1 - lam2) / (lam1 + lam2 + 1e-6);
    outColor = vec4(angle, anisotropy, 0.0, 0.0);
}

