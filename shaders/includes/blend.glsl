vec3 applyBlend(vec3 base, vec3 fx, float blendAmount) {
vec3 blended;
const float EPS = 1e-5;

// NOTE: some of these work very oddly with opponent RGB, because it's not
// normalized internally. This is acceptable.
// NOTE: consumer is responsible for re-transforming or clamping output (this
// function does not assume the correct output range is 0-1, that it should be in sRGB, etc.)

#if BLENDMODE == 0  // Replace
    blended = fx;
#elif BLENDMODE == 1  // Mix
    blended = mix(base, fx, blendAmount);
#elif BLENDMODE == 2  // Add
    blended = base + fx * blendAmount;
#elif BLENDMODE == 3  // Multiply
    blended = mix(base, base * fx, blendAmount);
#elif BLENDMODE == 4  // Screen
    vec3 screen = 1.0 - (1.0 - base) * (1.0 - fx);
    blended = mix(base, screen, blendAmount);
#elif BLENDMODE == 5  // Overlay
    vec3 overlay = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(0.5, base)
    );
    blended = mix(base, overlay, blendAmount);
#elif BLENDMODE == 6  // Darken
    blended = mix(base, min(base, fx), blendAmount);
#elif BLENDMODE == 7  // Lighten
    blended = mix(base, max(base, fx), blendAmount);
#elif BLENDMODE == 8  // Difference
    vec3 diff = abs(base - fx);
    blended = mix(base, diff, blendAmount);
#elif BLENDMODE == 9  // Soft Light
    vec3 result = mix(
        2.0 * base * fx + base * base * (1.0 - 2.0 * fx),
        sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx),
        step(0.5, fx)
    );
    blended = mix(base, clamp(result, 0., 1.), blendAmount);
#elif BLENDMODE == 10  // Hard Light
    vec3 result = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(0.5, fx)
    );
    blended = mix(base, result, blendAmount);
#elif BLENDMODE == 11  // Soft Light Inverse
    vec3 result = mix(
        2.0 * base * fx + base * base * (1.0 - 2.0 * fx),
        sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx),
        step(fx, vec3(0.5))
    );
    blended = mix(base, clamp(result, 0., 1.), blendAmount);
#elif BLENDMODE == 12  // Hard Light Inverse
    vec3 result = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(fx, vec3(0.5))
    );
    blended = mix(base, result, blendAmount);
#elif BLENDMODE == 13  // Color Dodge
    vec3 dodge = clamp(base / max(vec3(1.0) - fx, vec3(EPS)), 0.0, 1.0);
    blended = mix(base, dodge, blendAmount);
#elif BLENDMODE == 14  // Color Burn
    vec3 burn = 1.0 - clamp((vec3(1.0) - base) / max(fx, vec3(EPS)), 0.0, 1.0);
    blended = mix(base, burn, blendAmount);
#elif BLENDMODE == 15  // Vivid Light
    vec3 vividBurn  = 1.0 - clamp((vec3(1.0) - base) / max(2.0 * fx, vec3(EPS)), 0.0, 1.0);
    vec3 vividDodge = clamp(base / max(2.0 * (vec3(1.0) - fx), vec3(EPS)), 0.0, 1.0);
    vec3 vivid = mix(vividBurn, vividDodge, step(vec3(0.5), fx));
    blended = mix(base, vivid, blendAmount);
#elif BLENDMODE == 16 // Power
    vec3 expanded = clamp(fx, 0.0, 1.0) * 2.0;
    vec3 power = pow(base, expanded);
    blended = mix(base, power, blendAmount);
#else
    #error;
#endif
    return blended;
}

float applyBlend(float base, float fx, float blendAmount) {
#if BLENDMODE == 0  // Replace
    return fx;
#elif BLENDMODE == 1  // Mix
    return mix(base, fx, blendAmount);
#elif BLENDMODE == 2  // Add
    return base + fx * blendAmount;
#elif BLENDMODE == 3  // Multiply
    return mix(base, base * fx, blendAmount);
#elif BLENDMODE == 4  // Screen
    float screen = 1.0 - (1.0 - base) * (1.0 - fx);
    return mix(base, screen, blendAmount);
#elif BLENDMODE == 5  // Overlay
    float overlay = base < 0.5
        ? 2.0 * base * fx
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - fx);
    return mix(base, overlay, blendAmount);
#elif BLENDMODE == 6  // Darken
    return mix(base, min(base, fx), blendAmount);
#elif BLENDMODE == 7  // Lighten
    return mix(base, max(base, fx), blendAmount);
#elif BLENDMODE == 8  // Difference
    float diff = abs(base - fx);
    return mix(base, diff, blendAmount);
#elif BLENDMODE == 9  // Soft Light
    float result = fx < 0.5
        ? 2.0 * base * fx + base * base * (1.0 - 2.0 * fx)
        : sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx);
    return mix(base, result, blendAmount);
#elif BLENDMODE == 10  // Hard Light
    float result = fx < 0.5
        ? 2.0 * base * fx
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - fx);
    return mix(base, result, blendAmount);
#elif BLENDMODE == 11  // Soft Light Inverse
    float result = fx >= 0.5
        ? 2.0 * base * fx + base * base * (1.0 - 2.0 * fx)
        : sqrt(base) * (2.0 * fx - 1.0) + 2.0 * base * (1.0 - fx);
    return mix(base, result, blendAmount);
#elif BLENDMODE == 12  // Hard Light Inverse
    float result = fx >= 0.5
        ? 2.0 * base * fx
        : 1.0 - 2.0 * (1.0 - base) * (1.0 - fx);
    return mix(base, result, blendAmount);
#elif BLENDMODE == 13  // Color Dodge
    float dodge = fx >= 1.0
        ? 1.0
        : min(base / (1.0 - fx), 1.0);
    return mix(base, dodge, blendAmount);
#elif BLENDMODE == 14  // Color Burn
    float burn = fx <= 0.0
        ? 0.0
        : max(1.0 - (1.0 - base) / fx, 0.0);
    return mix(base, burn, blendAmount);
#elif BLENDMODE == 15  // Vivid Light
    float vivid = fx < 0.5
        ? (fx <= 0.0
            ? 0.0
            : max(1.0 - (1.0 - base) / (2.0 * fx), 0.0))
        : (fx >= 1.0
            ? 1.0
            : min(base / (2.0 * (1.0 - fx)), 1.0));
    return mix(base, vivid, blendAmount);
#elif BLENDMODE == 16
    float expanded = clamp(fx, 0.0, 1.0) * 2.0;
    float power = pow(base, expanded);
    return mix(base, power, blendAmount);
#else
    #error;
#endif
}

#ifndef BLEND_CHANNEL_MODE
#define BLEND_CHANNEL_MODE 0
#endif

vec3 blendChannelMasked(vec3 base, vec3 fx, float blendAmount) {
#if BLEND_CHANNEL_MODE == 0  // ALL
    return applyBlend(base, fx, blendAmount);
#elif BLEND_CHANNEL_MODE == 1
    return vec3(
        applyBlend(base.x, fx.x, blendAmount),
        base.yz
    );
#elif BLEND_CHANNEL_MODE == 2
    return vec3(
        base.x,
        applyBlend(base.y, fx.y, blendAmount),
        base.z
    );
#elif BLEND_CHANNEL_MODE == 3
    return vec3(
        base.xy,
        applyBlend(base.z, fx.z, blendAmount)
    );
#else
    return base;
#endif
}

// NOTE: for some blend modes, these can go out of gamut prior to
//  the encodeColor() step. this is intentional for artistic reasons.

vec3 blendWithColorSpace(vec3 baseRGB, vec3 fxRGB, float blendAmount) {
    vec3 base = extractColor(baseRGB);
    vec3 fx = extractColor(fxRGB);
    vec3 blended = blendChannelMasked(base, fx, blendAmount);
    return clamp(encodeColor(blended), 0.0, 1.0);
}

vec3 blendWithColorSpace(vec3 baseRGB, float fxGray, float blendAmount) {
    vec3 base = extractColor(baseRGB);
    vec3 fx = extractColor(vec3(fxGray));
    vec3 blended = blendChannelMasked(base, fx, blendAmount);
    return clamp(encodeColor(blended), 0.0, 1.0);
}

vec3 blendWithColorSpace(float baseGray, float fxGray, float blendAmount) {
    vec3 base = extractColor(vec3(baseGray));
    vec3 fx = extractColor(vec3(fxGray));
    vec3 blended = blendChannelMasked(base, fx, blendAmount);
    return clamp(encodeColor(blended), 0.0, 1.0);
}
