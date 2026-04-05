/**
 * Generate an unnormalized 1D kernel based on shape, radius, and softness.
 * @param {string} type - Kernel shape ('gaussian', 'lorentzian', 'box', etc.)
 * @param {number} radius - Half-width in pixels (controls size, not array length)
 * @param {number} softness - Shape-specific param (e.g. sigma, decay, etc.)
 * @param {number} freq - kernel frequency (gabor only)
 * @returns {Float32Array} - Unnormalized kernel
 */
export function generateKernel(type, radius = 3, softness = 1.0, freq = 0.5) {
    const size = Math.max(3, 2 * Math.ceil(radius) + 1);
    const kernel = new Float32Array(size);
    const half = Math.floor(size / 2);
    softness = softness < 1e-6 ? 1e-6 : softness;

    for (let i = 0; i < size; i++) {
        const x = i - half;
        let w = 0;
        switch (type) {
            case 'gaussian':
                w = Math.exp(-0.5 * (x * x) / (softness * softness));
                break;
            case 'lorentzian':
                w = 1.0 / (1.0 + (x * x) / (softness * softness));
                break;
            case 'log':
                w = (
                    (x * x) / (softness * softness * softness * softness)
                    - 1 / (softness * softness)
                ) * Math.exp(-(x * x) / (2 * softness * softness));
                break;
            case 'exponential':
                w = Math.exp(-Math.abs(x) / softness);
                break;
            case 'box':
                w = 1.0;
                break;
            case 'flattop':
                w = Math.exp(-0.5 * (x * x) / (softness * softness)) *
                    (1.0 + 0.2 * Math.cos((2.0 * Math.PI * x) / size));
                break;
            case 'sinc':
                const t = x / softness;
                w = t === 0 ? 1.0 : Math.sin(Math.PI * t) / (Math.PI * t);
                break;
            case 'gabor':
                w = Math.exp(-0.5 * (x * x) / (softness * softness)) *
                    Math.cos(2.0 * Math.PI * freq * x);
                break;
            case 'altsign':
                w = i % 2 === 0 ? 1 : -1;
                break;
            case 'saw':
                w = i + 1;
                break;
            case 'sobel1d':
                w = x;
                break;
            case 'impulse':
                for (let ix = 0; ix < size; ix++) {
                    kernel[ix] = (ix === half - 2) ? 1 : (ix === half + 2) ? -1 : 0;
                }
                return kernel;
            case 'triangle':
                w = 1 - Math.abs(x) / half;
                break;
            case 'hann':
                 w = 0.5 * (1 + Math.cos(Math.PI * x / half));
                 break;
            default:
                throw new Error(`unknown kernel type ${type}`);
        }
        kernel[i] = w;
    }
    return kernel;
}

export function normalizeKernel(kernel) {
    const sum = kernel.reduce((a, b) => a + b, 0);
    if (sum === 0) return kernel;
    return kernel.map(v => v / sum);
}

export const KernelTypeEnum = {
    GAUSSIAN: 'gaussian',
    LORENTZIAN: 'lorentzian',
    EXPONENTIAL: 'exponential',
    BOX: 'box',
    FLATTOP: 'flattop',
    SINC: 'sinc',
    GABOR: 'gabor',
    SOBEL1D: 'sobel1d',
    ALTSIGN: 'altsign',
    SAW: 'saw',
    IMPULSE: 'impulse',
    TRIANGLE: 'triangle',
    HANN: 'hann',
    LOG: 'log'
};


const normalizedKernels = [
    'gaussian', 'lorentzian', 'exponential', 'box', 'flattop',
    'hann', 'triangle'
]

/**
 * Generate a 2D convolution kernel via outer product of a 1D kernel,
 * normalized if appropriate.
 * @param {string} type - Kernel shape type
 * @param {number} radiusX - Horizontal kernel radius
 * @param {number} radiusY - Vertical kernel radius
 * @param {number} softness - Shape parameter (passed to 1D generator)
 * @param {number} freq - Kernel frequency (passed to 1D generator; only for gabor)
 * @returns {{
 *   kernel: Float32Array,
 *   width: number,
 *   height: number,
 *   type: string
 * }}
 */
export function generate2DKernel(type, radiusX = 3, radiusY = 3, softness = 1.0, freq = 0.5) {
    const kernelX = generateKernel(type, radiusX, softness, freq);
    const kernelY = generateKernel(type, radiusY, softness, freq);
    const width = kernelX.length;
    const height = kernelY.length;

    let kernel = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            kernel[y * width + x] = kernelX[x] * kernelY[y];
        }
    }
    if (normalizedKernels.includes(type)) {
        kernel = normalizeKernel(kernel);
    }

    return {
        kernel: kernel,
        width: width,
        height: height,
        type: type
    };
}

export function subsampleKernel2D(kernelInfo, maxSize) {
    const {width, height, type, kernel} = kernelInfo;
    const ratio = Math.sqrt(maxSize / (width * height));
    const newW = Math.max(1, Math.floor(width * ratio));
    const newH = Math.max(1, Math.floor(height * ratio));

    let out = new Float32Array(newW * newH);
    for (let y = 0; y < newH; y++) {
        for (let x = 0; x < newW; x++) {
            const srcX = Math.floor((x / newW) * width);
            const srcY = Math.floor((y / newH) * height);
            out[y * newW + x] = kernel[srcY * width + srcX];
        }
    }
    if (normalizedKernels.includes(type)) {
        out = normalizeKernel(out);
    }
    return {
        kernel: out,
        width: newW,
        height: newH,
        type: type
    };
}
