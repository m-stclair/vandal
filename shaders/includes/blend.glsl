// Available COLORSPACE values:
#define COLORSPACE_RGB 0
#define COLORSPACE_LAB 1
#define COLORSPACE_LCH 2
#define COLORSPACE_HSV 3

#ifndef COLORSPACE
#define COLORSPACE COLORSPACE_RGB
#endif

#if COLORSPACE == COLORSPACE_LAB
#define IN_LAB_UNITS 1
#elif COLORSPACE == COLORSPACE_LCH
#define IN_LAB_UNITS 1
#else
#define IN_LAB_UNITS 0
#endif

#if BLENDMODE == 4
#define NEEDS_LAB_NORM 1
#elif BLENDMODE == 5
#define NEEDS_LAB_NORM 1
#elif BLENDMODE == 9
#define NEEDS_LAB_NORM 1
#elif BLENDMODE == 10
#define NEEDS_LAB_NORM 1
#else
#define NEEDS_LAB_NORM 1
#endif


vec3 applyBlend(vec3 base, vec3 fx, float blendAmount) {
//
//#if NEEDS_LAB_NORM == 1
//#if COLORSPACE == COLORSPACE_LAB
//    base = normalizeLab(base);
//#elif COLORSPACE == COLORSPACE_LCH
//    base = normalizeLCH(base);
//#endif
//#endif

vec3 blended;

#if BLENDMODE == 0  // Replace
    blended = fx;
#if BLENDMODE == 1  // Mix
    blanded = mix(base, fx, blendAmount);
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
    //
    //#if NEEDS_LAB_NORM == 1
    //#if COLORSPACE == COLORSPACE_LAB
    //    blended = denormalizeLab(blended);
    //#elif COLORSPACE == COLORSPACE_LCH
    //    blended = denormalizeLCH(blended);
    //#endif
    //#endif
    return blended;
}

vec3 blendWithColorSpace(vec3 baseRGB, vec3 fxRGB, float blendAmount) {
#if COLORSPACE == COLORSPACE_RGB
    return applyBlend(baseRGB, fxRGB, blendAmount);
#elif COLORSPACE == COLORSPACE_LAB
    vec3 baseLab = rgb2lab(baseRGB);
    vec3 fxLab = rgb2lab(fxRGB);
    vec3 blended = applyBlend(baseLab, fxLab, blendAmount);
    return lab2rgb(blended);
#elif COLORSPACE == COLORSPACE_LCH
    vec3 baseLCH = rgb2lch(baseRGB);
    vec3 fxLCH = rgb2lch(fxRGB);
    vec3 blended = applyBlend(baseLCH, fxLCH, blendAmount);
    return lch2rgb(blended);
#elif COLORSPACE == COLORSPACE_HSV
    vec3 baseHSV = rgb2hsv(baseRGB);
    vec3 fxHSV = rgb2hsv(fxRGB);
    vec3 blended = applyBlend(baseHSV, fxHSV, blendAmount);
    return hsv2rgb(blended);
#else
    return applyBlend(baseRGB, fxRGB, blendAmount); // Fallback
#endif
}
