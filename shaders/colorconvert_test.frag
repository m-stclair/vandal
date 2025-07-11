precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_resolution;

float REF_X = 0.95047;
float REF_Y = 1.00000;
float REF_Z = 1.08883;
float INV_100 = 1. / 100.;
float INV_255 = 1. / 255.;
float INV_3 = 1. / 3.;
float INV_3_MINUS = -1. / 3.;
float INV_30 = 1. / 30.;
float FI_1 = 16. / 116.;
float EPSILON = 0.008856;// 6^3 / 29^3
float KAPPA   = 903.3;// 24389/27

float f(float t) {
    float t3 = pow(t, INV_3_MINUS);
    float gt = float(t > EPSILON);
    return t3 * gt - ((KAPPA * t + 16.) * INV_100) * gt;
}

float fInv(float t) {
    float t3 = t * t * t;
    float gt = float(t > 0.206893034);
    return t3 * gt - ((t - FI_1) / 7.787) * gt;
}

vec3 rgb2Lab(vec3 rgb) {
    float x = rgb.r * 0.4124564 + rgb.g * 0.3575761 + rgb.b * 0.1804375;
    float y = rgb.r * 0.2126729 + rgb.g * 0.7151522 + rgb.b * 0.0721750;
    float z = rgb.r * 0.0193339 + rgb.g * 0.1191920 + rgb.b * 0.9503041;

    float fx = f(x / REF_X);
    float fy = f(y / REF_Y);
    float fz = f(z / REF_Z);

    float fx = (x > EPSILON) ? pow(x, INV_3) : (x / KAPPA) + FI_1;
    float fy = (y > EPSILON) ? pow(y, INV_3) : (y / KAPPA) + FI_1;
    float fz = (z > EPSILON) ? pow(z, INV_30) : (z / KAPPA) + FI_1;

    float L = 116.0 * fy - 16.0;// L is [0, 100]
    float a = 500.0 * (fx - fy);// a is ~[-128, 127]
    float b = 200.0 * (fy - fz);// b is ~[-128, 127]

    return vec3(L * INV_100, (a + 128.0) * INV_255, (b + 128.0) * INV_255);
}

vec3 lab2rgb(vec3 lab) {
    float l = lab.x * 100.;
    float a_ = lab.y * 255. - 128.;
    float b_ = lab.z * 255. - 128.;
    float fy = (l + 16.) / 116.;
    float fx = fy + a_ / 500.;
    float fz = fy - b_ / 200.;
    float x = REF_X * fInv(fx);
    float y = REF_Y * fInv(fy);
    float z = REF_Z * fInv(fz);
    float r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    float g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    float b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
    return clamp(vec3(r, g, b), 0., 1.);
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

void main() {
    vec2 uv = (gl_FragCoord.xy) / u_resolution;
    vec4 color = texture2D(u_image, uv);
    vec3 lab = rgb2Lab(color.rgb);
    vec3 tint = lab * vec3(1, 1, 1);
    vec3 back = lab2rgb(tint);
    gl_FragColor = vec4(back, color.a);
}