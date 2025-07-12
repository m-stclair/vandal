#version 300 es

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blocksize;

out vec4 outColor;

vec2 pixelUV(vec2 uv, vec2 resolution, float blockSize) {
    vec2 gridUV = floor(uv * resolution / blockSize) * blockSize / resolution;
    return gridUV;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    outColor = texture(u_image, pixelUV(uv, u_resolution, u_blocksize));
}


