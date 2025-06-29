import {deg2rad} from "../utils/mathutils.js";
import waves from "../utils/waves.js";
import patterns from "../utils/patterns.js";
import {getLuminance, hsl2Rgb, rgb2Hsl} from "../utils/colorutils.js";

function spatialPhase(x, y, width, height, freq, mode) {
  if (mode === "none") return 0;
  const xNorm = x / width;
  const yNorm = y / height;
  switch (mode) {
    case "xy":
      return patterns.bands(xNorm, yNorm, freq);
    case "checker":
      return patterns.checks(xNorm, yNorm, freq);
    case "radial": {
      return patterns.radial(xNorm, yNorm, freq);
    }
    case "rings": {
      return patterns.rings(xNorm, yNorm, freq);
    }
    default:
      return 0;
  }
}

function applyPatternMoire(inputCtx, outputCtx, config) {
    const { width, height } = inputCtx.canvas;
    const inputData = inputCtx.getImageData(0, 0, width, height);
    const outputData = outputCtx.createImageData(width, height);
    const {freq, freqScale, phaseScale, spatialMode, waveform, 
      blend, phaseOff, hueModStrength, colorMode} = config;
    const phaseOffRad = deg2rad(phaseOff);
    let waveFunc;
    switch (waveform) {
      case "sawtooth":
        waveFunc = waves.saw;
        break;
      case "square":
        waveFunc = waves.square;
        break;
      case "sin":
        waveFunc = Math.sin;
        break;
      case "tri":
        waveFunc = waves.tri;
        break;
      default:
        waveFunc = Math.sin;
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = inputData.data[i];
            const g = inputData.data[i + 1];
            const b = inputData.data[i + 2];

            const lum = getLuminance(r, g, b) / 255;
            const phase = lum * Math.PI * 2;
            const spatial = spatialPhase(x, y, width, height, freq, spatialMode);
            const patternA = waveFunc(spatial * freqScale + phase);
            const patternB = waveFunc(
                - phase * (
                   (spatial * freqScale + phase * phaseScale)
                ) + phaseOffRad
            );
            const patval = Math.abs(patternA - patternB) * 255;
            if (colorMode === "none") {
              const val = patval * blend + lum * (1 - blend) * 255;
              outputData.data[i] = val;
              outputData.data[i + 1] = val;
              outputData.data[i + 2] = val;
              outputData.data[i + 3] = 255;
            } else if (colorMode === "preserve") {
              const val = patval < lum * 255 ? patval * blend : 0;
              outputData.data[i] = r - val;
              outputData.data[i + 1] = g - val;
              outputData.data[i + 2] = b - val;
              outputData.data[i + 3] = 255;
            } else if (colorMode === "hueMod") {
              const [h, s, l] = rgb2Hsl(r, g, b);
              const mod = (patval / 255) * hueModStrength;
              const newHue = (h + mod) % 1;
              const [r1, g1, b1] = hsl2Rgb(newHue, s, l);

              outputData.data[i]     = r1;
              outputData.data[i + 1] = g1;
              outputData.data[i + 2] = b1;
              outputData.data[i + 3] = 255;
            } else {
              throw new Error("bad color mode");
            }
        }
    }
    outputCtx.putImageData(outputData, 0, 0);
}


/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
  name: "Contour Synth",
  defaultConfig: {
    freq: 1,
    freqScale: 1,
    phaseScale: 1,
    blend: 0.5,
    phaseOff: 0,
    spatialMode: "xy",
    colorMode: "none",
    hueModStrength: 0.5
  },
  uiLayout: [
    { 
        type: "range", 
        key: "freq", 
        label: "Spatial Frequency", 
        min: 0, 
        max: 100, 
        steps: 100, 
        scale: "log",
        scaleFactor: 2
    },
    { 
        type: "range", 
        key: "freqScale", 
        label: "Spatial Frequency Modulation", 
        min: 0, 
        max: 10, 
        steps: 100,
        scale: "log",
        scaleFactor: 2
    },
    { 
        type: "range", 
        key: "phaseScale", 
        label: "Phase Modulation", 
        min: 0, 
        max: 20, 
        steps: 100,
        scale: "log",
        scaleFactor: 2
    },
    { type: "range", key: "phaseOff", label: "Phase Offset", min: -180, max: 180, step: 1.5 },
    { type: "range", key: "blend", label: "Blend", min: 0, max: 1, step: 0.01 },
    {
      type: "select",
      key: "waveform",
      label: "Waveform",
      options: [
        { value: "sin", label: "Sinusoidal" },
        { value: "sawtooth", label: "Sawtooth" },
        { value: "square", label: "Square" },
        { value: "tri", label: "Triangle" }
      ]
    },
    {
      type: "select",
      key: "spatialMode",
      label: "Spatial Mode",
      options: [
        { value: "none", label: "None" },
        { value: "xy", label: "Bands" },
        { value: "checker", label: "Checkerboard" },
        { value: "radial", label: "Radial" },
        { value: "rings", label: "Rings" }
      ]
    },
    {
      type: "select",
      key: "colorMode",
      label: "Color Mode",
      options: [
        { value: "none", label: "Grey" },
        { value: "preserve", label: "Original" },
        { value: "hueMod", label: "Hue Mod" },
      ]
    },
    {
      type: "range",
      key: "hueModStrength",
      label: "Hue Mod Strength",
      min: 0,
      max: 1,
      step: 0.01,
      showIf: { colormode: "hueMod" }
    }
  ],

  apply(instance, inputImageData) {
    const width = inputImageData.width;
    const height = inputImageData.height;
    const inputCanvas = new OffscreenCanvas(inputImageData.width, inputImageData.height);
    const inputCtx = inputCanvas.getContext("2d");
    inputCtx.putImageData(inputImageData, 0, 0);
    const outputCanvas = new OffscreenCanvas(inputImageData.width, inputImageData.height);
    const outputCtx = inputCanvas.getContext("2d");
    applyPatternMoire(inputCtx, outputCtx, instance.config);
    return outputCtx.getImageData(0, 0, width, height);
  }
}
