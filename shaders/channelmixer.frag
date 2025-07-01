precision highp float;
uniform sampler2D u_image;
uniform vec2 u_resolution;

uniform vec3 u_rMix;
uniform vec3 u_gMix;
uniform vec3 u_bMix;
uniform vec3 u_offset;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec4 color = texture2D(u_image, uv);

    float r = dot(vec3(color.rgb), u_rMix) + u_offset.r;
    float g = dot(vec3(color.rgb), u_gMix) + u_offset.g;
    float b = dot(vec3(color.rgb), u_bMix) + u_offset.b;

    gl_FragColor = vec4(clamp(vec3(r, g, b), 0.0, 1.0), color.a);
}
