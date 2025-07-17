// effects/index.js

const effectFiles = [
    'chromawave.js',
    'pixelsort.js',
    'invert.js',
    // 'blur.js',
    // 'blur_svg.js',
    'aberration.js',
    // 'wave_old.js',
    'wave.js',
    'scanlines.js',
    'tile_desync.js',
    'banded_flip.js',
    'colorshred.js',
    'jointshred.js',
    'edgetrace.js',
    'morphops_svg.js',
    // 'hillshade.js',
    'pixelate.js',
    // "pixelate_old.js",
    "warpnoise_svg.js",
    // "palette_debug.js",
    "reinhardTransfer.js",
    "contour_synth.js",
    "fir.js",
    "delayline.js",
    "affine_transform.js",
    "channelmixer.js",
    // "matrix_channelmixer.js",
    "perlin_distort.js",
    "noisemixer.js",
    "posterize.js",
    "bcs.js",
    "look.js",
    "auto_levels.js",
    "colormap.js",
    "gridpattern.js",
    "warpzone.js",
    "bloom.js",
    "kernel2d.js",
    "pseudosort.js",
    "badTV.js",
    "palette_synth.js"
]
import {makeRegistryEntry} from "./utils/registry_utils.js";

const effectEntries = await Promise.all(
  effectFiles.map(async filename => {
    const url = new URL(`./effects/${filename}`, import.meta.url).href;
    const mod = await import(url);
    return makeRegistryEntry(mod, filename);
  })
);

export const effectRegistry = Object.fromEntries(
  effectEntries.map(entry => [entry.name, entry])
);

export const effectGroups = {};

for (const effect of Object.values(effectRegistry)) {
  const group = effect.group || 'Uncategorized';
  if (!effectGroups[group]) effectGroups[group] = [];
  effectGroups[group].push(effect);
}

console.log("effect registry")
console.log(Object.values(effectRegistry))
console.log("effect metadata")
console.log(Object.values(effectRegistry).map((v) => v.meta));

/** @typedef {import('./glitchtypes.ts').EffectModule} EffectModule */
/** @type {Array<{name: string, mod: EffectModule}>} */
const flatEffects = Object.values(effectGroups).map(group =>
    group.map(effect => ({name: effect.name, mod: effect})));