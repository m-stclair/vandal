#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

layout(std140) uniform PaletteBlock {
    vec4 paletteColors[256]; // padded vec3s
};
uniform int u_paletteSize;
uniform int u_cycleOffset;
uniform int u_blendK;
uniform float u_softness;
uniform float u_lumaWeight;
uniform float u_chromaWeight;
uniform float u_hueWeight;
uniform float u_blendAmount;

out vec4 outColor;

#include "colorconvert.glsl"
#include "blend.glsl"

#define MAX_PALETTE_SIZE 64

#define ASSIGN_NEAREST 0
#define ASSIGN_HUE 1
#define ASSIGN_BLEND 2

float hueAngle(vec2 ab) {
  return atan(ab.y, ab.x); // returns radians in [-π, π]
}

float angleDiff(float a1, float a2) {
  float d = abs(a1 - a2);
  return min(d, 6.28318530718 - d); // wrap around 2π
}


float squared_deltaE(vec3 lab1, vec3 lab2) {
    float d = dot(lab1 - lab2, lab1 - lab2);
    return d * d;
}


float deltaE_withBias(vec3 lab1, vec3 lab2, float lumaW, float chromaW, float hueW) {
    float dE = squared_deltaE(lab1, lab2);
    float hueDiff = angleDiff(hueAngle(lab1.yz), hueAngle(lab2.yz));
    float chromaBias = abs(length(lab1.yz) - length(lab2.yz));
    float lumaBias   = abs(lab1.x - lab2.x);

    return (
        dE
      + hueW * hueDiff
      + chromaW * chromaBias
      + lumaW * lumaBias
    );
}


vec3 softAssign(vec3 labColor, int cycleOffset) {
  float dist[MAX_PALETTE_SIZE];
  int index[MAX_PALETTE_SIZE];

  // Compute distances
  for (int i = 0; i < u_paletteSize; ++i) {
    dist[i] = deltaE_withBias(labColor, paletteColors[i].rgb, u_lumaWeight,
                              u_chromaWeight, u_hueWeight);
    index[i] = i;
  }

  // Partial bubble sort top K
  for (int i = 0; i < u_blendK; ++i) {
    for (int j = i + 1; j < u_paletteSize; ++j) {
      if (dist[j] < dist[i]) {
        float td = dist[i]; dist[i] = dist[j]; dist[j] = td;
        int ti = index[i]; index[i] = index[j]; index[j] = ti;
      }
    }
  }


  // Blend top K
  vec3 result = vec3(0.0);
  float totalWeight = 0.0;
  for (int i = 0; i < u_blendK; ++i) {
    float w = 1.0 / pow(dist[i] + 1e-5, u_softness); // sharper with higher softness
    result += w * paletteColors[(index[i] + cycleOffset) % u_paletteSize].rgb;
    totalWeight += w;
  }

  return result / totalWeight;
}

vec3 matchHue(vec3 lab, int cycleOffset) {
    float inputHue = hueAngle(lab.yz); // a = y, b = z

    int bestIndex = 0;
    float bestDiff = 1e9;

    for (int i = 0; i < u_paletteSize; ++i) {
      float binHue = hueAngle(paletteColors[i].yz);
      float d = angleDiff(inputHue, binHue);

      if (d < bestDiff) {
        bestDiff = d;
        bestIndex = i;
      }
    }
    return paletteColors[(bestIndex + cycleOffset) % u_paletteSize].rgb;
}

vec3 matchNearest(vec3 lab, int cycleOffset) {
    float minDist = 1e6;
    int best_i = 0;

    for (int i = 0; i < 256; i++) {
        if (i >= u_paletteSize) break;

        vec3 p = paletteColors[i].rgb;
        float d = deltaE_withBias(lab, p, u_lumaWeight, u_chromaWeight,
                                  u_hueWeight);
        if (d < minDist) {
            minDist = d;
            best_i = i;
        }
    }
    return paletteColors[(best_i + cycleOffset) % u_paletteSize].rgb;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
#if SHOW_PALETTE != 0
    int idx = int(round(uv.x * float(u_paletteSize - 1)));
    vec4 pcolor = paletteColors[(idx + u_cycleOffset) % u_paletteSize];
#if SHOW_PALETTE == 1
    if (pcolor.a > 1. - uv.y) {
#else
    if (uv.y < 0.1) {
#endif
        outColor = vec4(normLab2SRGB(pcolor.rgb), 1.);
        return;
    }
#endif
    vec3 color = texture(u_image, uv).rgb;
    vec3 lab = srgb2NormLab(color);
#if ASSIGNMODE == ASSIGN_BLEND
    vec3 labMapped = softAssign(lab, u_cycleOffset);
#elif ASSIGNMODE == ASSIGN_HUE
    vec3 labMapped = matchHue(lab, u_cycleOffset);
#else
    vec3 labMapped = matchNearest(lab, u_cycleOffset);
#endif
    vec3 srgb = normLab2SRGB(labMapped);
    outColor = vec4(
        blendWithColorSpace(color, normLab2SRGB(labMapped), u_blendAmount),
        1.0
    );
}