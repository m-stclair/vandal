function splitChannels(data, width, height) {
    const size = width * height;
    const r = new Uint8ClampedArray(size);
    const g = new Uint8ClampedArray(size);
    const b = new Uint8ClampedArray(size);
    const a = new Uint8ClampedArray(size);

    for (let i = 0; i < size; i++) {
        r[i] = data[i * 4];
        g[i] = data[i * 4 + 1];
        b[i] = data[i * 4 + 2];
        a[i] = data[i * 4 + 3];
    }

    return { r, g, b, a };
}

function combineChannels({ r, g, b, a, width, height }) {
    const output = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
        output[i * 4]     = r[i];
        output[i * 4 + 1] = g[i];
        output[i * 4 + 2] = b[i];
        output[i * 4 + 3] = a ? a[i] : 255;
    }
    return output;
}

export { splitChannels, combineChannels };