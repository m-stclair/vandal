vec3 applyBlend(vec3 base, vec3 fx, float blendAmount) {
vec3 blended;
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
        step(fx, vec3(0.5))
    );
    blended = mix(base, result, blendAmount);
#elif BLENDMODE == 10  // Hard Light
    vec3 result = mix(
        2.0 * base * fx,
        1.0 - 2.0 * (1.0 - base) * (1.0 - fx),
        step(0.5, fx)
    );
    blended = mix(base, result, blendAmount);
#else
    blended = fx;
#endif
    return blended;
}

vec3 blendWithColorSpace(vec3 baseRGB, vec3 fxRGB, float blendAmount) {
    vec3 base = extractColor(baseRGB);
    vec3 fx = extractColor(fxRGB);
    vec3 blend = applyBlend(base, fx, blendAmount);
    return encodeColor(blend);
}
