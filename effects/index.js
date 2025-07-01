// effects/index.js
import pixelsort from './pixelsort.js';
import blur from './blur.js';
import blur_svg from './blur_svg.js';
import rgbShiftSvg from './rgbshift_svg.js';
import wave from './wave.js';
import scanlines from './scanlines.js';
import posterize from './posterize.js';
import threshcycle from './threshcycle.js';
import tileDesync from './tile_desync.js';
import bandedFlip from './banded_flip.js';
import colorShred from './colorshred.js';
import jointShred from './jointshred.js';
import edgeTrace from './edgetrace.js';
import morphOp from './morphops.js';
import hillShade from './hillshade.js';
import stretchEffect from "./stretch_effect.js";
import bcsAdjustments from "./brightness_contrast_saturation.js";
import pixelate from "./pixelate.js";
import warpNoise from "./warpnoise_svg.js";
import paletteDebug from "./palette_debug.js";
import reinhardTransfer from "./reinhardTransfer.js";
import contourSynth from "./contour_synth.js";
import colorMap from "./colormap.js";
import FIR from "./fir.js";
import delayLineGL from "./delayline_gl.js";
import affineTransform from "./affine_transform.js";
import channelMixerRGB from "./channelmixer_rgb_gl.js";
import channelMixer from "./channelmixer.js";

export const effectGroups = [
  {
    label: "Core Adjustments",
    effects: [channelMixer, stretchEffect, bcsAdjustments, colorMap, affineTransform, channelMixerRGB]
  },
  {
    label: "Structural",
    effects: [contourSynth, colorShred, jointShred, edgeTrace, hillShade]
  },
  {
    label: 'Color Effects',
    effects: [posterize, reinhardTransfer, threshcycle]
  },
  {
    label: "Disruptive / Desync",
    effects: [delayLineGL, FIR, pixelsort, tileDesync, bandedFlip, warpNoise]
  },
  {
    label: "Distortions",
    effects: [pixelate, wave, morphOp, rgbShiftSvg, blur, blur_svg]
  },
  {
    label: "Patterns",
    effects: [scanlines]
  },
  {
    label: "System / Debug",
    effects: [paletteDebug]
  }
];

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {Array<{name: string, mod: EffectModule}>} */
const flatEffects = effectGroups.flatMap(group =>
  group.effects.map(effect => ({ name: effect.name, mod: effect }))
);

/** @type {{[name: string]: EffectModule}} */
export const effectRegistry = Object.fromEntries(
  flatEffects.map(({ name, mod }) => [name, mod])
);