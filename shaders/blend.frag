// Normal Blend Mode
vec3 linearBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, (top + bot) / 2.0, intensity);
}

// Multiply Blend Mode
vec3 multiplyBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, top * bot, intensity);
}

// Screen Blend Mode (Inverse Multiply)
vec3 screenBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, 1.0 - (1.0 - top) * (1.0 - bot), intensity);
}

// Overlay Blend Mode
vec3 overlayBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, mix(2.0 * top * bot, 1.0 - 2.0 * (1.0 - top) * (1.0 - bot), step(0.5, bot)), intensity);
}

// Darken Blend Mode
vec3 darkenBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, min(top, bot), intensity);
}

// Lighten Blend Mode
vec3 lightenBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, max(top, bot), intensity);
}

// Difference Blend Mode
vec3 differenceBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, abs(top - bot), intensity);
}

// Exclusion Blend Mode
vec3 exclusionBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, top + bot - 2.0 * top * bot, intensity);
}

// Additive Blend Mode
vec3 additiveBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, min(top + bot, vec3(1.0)), intensity);
}

// Subtract Blend Mode
vec3 subtractBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, max(top - bot, vec3(0.0)), intensity);
}

// Hard Light Blend Mode
vec3 hardLightBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, mix(2.0 * top * bot, 1.0 - 2.0 * (1.0 - top) * (1.0 - bot), step(0.5, top)), intensity);
}

// Soft Light Blend Mode
vec3 softLightBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, mix(bot, 1.0 - (1.0 - bot) * (1.0 - top), 0.5), intensity);
}

// Color Dodge Blend Mode
vec3 colorDodgeBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, min(top / (1.0 - bot), vec3(1.0)), intensity);
}

// Convert RGB to HSV
vec3 rgb2hsv(vec3 c) {
    float maxc = max(c.r, max(c.g, c.b));
    float minc = min(c.r, min(c.g, c.b));
    float delta = maxc - minc;

    float h = 0.0;
    float s = (maxc == 0.0) ? 0.0 : (delta / maxc);
    float v = maxc;

    if (delta != 0.0) {
        if (maxc == c.r) {
            h = (c.g - c.b) / delta;
        } else if (maxc == c.g) {
            h = (c.b - c.r) / delta + 2.0;
        } else {
            h = (c.r - c.g) / delta + 4.0;
        }
        h /= 6.0;
        if (h < 0.0) h += 1.0;
    }

    return vec3(h, s, v);
}

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    float h = c.x * 6.0;
    float s = c.y;
    float v = c.z;

    int i = int(floor(h));
    float f = h - float(i);
    float p = v * (1.0 - s);
    float q = v * (1.0 - f * s);
    float t = v * (1.0 - (1.0 - f) * s);

    if (i == 0) return vec3(v, t, p);
    if (i == 1) return vec3(q, v, p);
    if (i == 2) return vec3(p, v, t);
    if (i == 3) return vec3(p, q, v);
    if (i == 4) return vec3(t, p, v);
    return vec3(v, p, q);
}

// Color Burn Blend Mode
vec3 colorBurnBlend(vec3 top, vec3 bot, float intensity) {
    return mix(top, 1.0 - min((1.0 - top) / bot, vec3(1.0)), intensity);
}
//
//// Hue Blend Mode (based on hue of the top)
//vec3 hueBlend(vec3 top, vec3 bot) {
//    vec3 hsv_top = rgb2hsv(top);
//    vec3 hsv_bot = rgb2hsv(bot);
//    hsv_top.x = hsv_bot.x;
//    return hsv2rgb(hsv_top);
//}
//
//// Saturation Blend Mode (based on saturation of the top)
//vec3 saturationBlend(vec3 top, vec3 bot) {
//    vec3 hsv_top = rgb2hsv(top);
//    vec3 hsv_bot = rgb2hsv(bot);
//    hsv_top.y = hsv_bot.y;
//    return hsv2rgb(hsv_top);
//}
//
//// Color Blend Mode (based on hue and saturation of the top)
//vec3 colorBlend(vec3 top, vec3 bot) {
//    vec3 hsv_top = rgb2hsv(top);
//    vec3 hsv_bot = rgb2hsv(bot);
//    hsv_top.x = hsv_bot.x;
//    hsv_top.y = hsv_bot.y;
//    return hsv2rgb(hsv_top);
//}
//
//// Luminosity Blend Mode (based on brightness of the top)
//vec3 luminosityBlend(vec3 top, vec3 bot) {
//    vec3 hsv_top = rgb2hsv(top);
//    vec3 hsv_bot = rgb2hsv(bot);
//    hsv_top.z = hsv_bot.z;
//    return hsv2rgb(hsv_top);
//}
//
//}

//// Linear RGB [0,1] -> Normalized Lab [0,1]^3
//vec3 rgb2Lab(vec3 rgb) {
//    // Convert RGB to XYZ (using the same matrix you provided)
//    float x = rgb.r * 0.4124564 + rgb.g * 0.3575761 + rgb.b * 0.1804375;
//    float y = rgb.r * 0.2126729 + rgb.g * 0.7151522 + rgb.b * 0.0721750;
//    float z = rgb.r * 0.0193339 + rgb.g * 0.1191920 + rgb.b * 0.9503041;
//
//    // Normalize XYZ
//    x /= REF_X;
//    y /= REF_Y;
//    z /= REF_Z;
//
//    // Apply the function f(x) = x^(1/3) for normalized values
//    float fx = (x > 0.008856) ? pow(x, 1.0 / 3.0) : (x / 903.3) + 16.0 / 116.0;
//    float fy = (y > 0.008856) ? pow(y, 1.0 / 3.0) : (y / 903.3) + 16.0 / 116.0;
//    float fz = (z > 0.008856) ? pow(z, 1.0 / 3.0) : (z / 903.3) + 16.0 / 116.0;
//
//    // Calculate Lab
//    float L = 116.0 * fy - 16.0; // L is [0, 100]
//    float a = 500.0 * (fx - fy);  // a is ~[-128, 127]
//    float b = 200.0 * (fy - fz);  // b is ~[-128, 127]
//
//    return vec3(L * INV_100, (a + 128.0) * INV_255, (b + 128.0) * INV_255);
//}
