// affine_transform.frag

precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform mat2 u_affine;
uniform int u_wrap;

void main() {
  vec2 uv = (gl_FragCoord.xy + vec2(0.5)) / u_resolution;
  vec2 center = vec2(0.5, 0.5);
  vec2 offset = uv - center;
  vec2 transformed;
  if (bool(u_wrap)) {
    transformed = fract(u_affine * offset + center + u_offset);
  } else {
    transformed = u_affine * offset + center + u_offset;
  }
  gl_FragColor = texture2D(u_image, transformed);
}
