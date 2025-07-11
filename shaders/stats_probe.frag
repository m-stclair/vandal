#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_input;
out vec4 fragColor;

void main() {
    vec3 color = texture(u_input, v_uv).rgb;
    float luma = dot(color, vec3(0.299, 0.587, 0.114)); // or choose your metric
    fragColor = vec4(luma, 0.0, 0.0, 1.0); // R holds sample
}
