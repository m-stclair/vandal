import {canvas, defaultCtx} from "./ui.js";
import {gid, uuidv4} from "./utils/helpers.js";
import {normalizeImageData} from "./utils/imageutils.js";
import {webGLState} from "./utils/webgl_state.js";
import {GlitchRenderer} from "./utils/glitch_renderer.js"


export const Dirty = {image: true, ui: true}
export const Lock = {image: false, ui: false}
export const requestRender = () => Dirty.image = true;
export const requestUIDraw = () => Dirty.ui = true;


let effectStack = [];

let selectedEffectId = "none";

export function getSelectedEffectId() {
    return selectedEffectId;
}
export function setSelectedEffectId(id) {
    selectedEffectId = id;
}

export function toggleEffectSelection(fx) {
    if (selectedEffectId === fx.id) {
        selectedEffectId = "none";
    } else {
        selectedEffectId = fx.id;
    }
}

export function isSelectedEffect(fx) {
    return selectedEffectId === fx.id;
}

export function getEffectById(id) {
    const matches = effectStack.filter((fx) => fx.id === id);
    if (matches.length === 0) return null;
    if (matches.length > 1) throw new Error("Duplicate effect ids");
    return matches[0];
}

export function forEachEffect(cb) {
    return effectStack.forEach(cb);
}

export function getActiveEffects() {
    const soloed = effectStack.find(fx => fx.solo);
    if (soloed) return [soloed];
    return effectStack.filter(fx => !fx.disabled);
}

export function forEachActiveEffect(cb) {
    return getActiveEffects().forEach(cb);
}


export function filterEffectStack(func) {
    effectStack = effectStack.filter(func);
}

let freezeAnimationFlag = false;
let freezeAnimationButtonFlag = false;
export const getAnimationFrozen = () => {
    return freezeAnimationFlag || freezeAnimationButtonFlag;
}
export const setFreezeAnimationFlag = (v) => freezeAnimationFlag = v;
export const setFreezeAnimationButtonFlag = (v) => {
    freezeAnimationButtonFlag = v;
}


export function flushEffectStack() {
    effectStack.length = 0;
}

export function addEffectToStack(fx) {
    if (!fx) return;
    effectStack.push(fx);
}

export function getEffectStack() {
    return effectStack;
}

export const renderCache = new Map();

export function clearRenderCache() {
    renderCache.clear();
}

export function renderCacheSet(k, v) {
    renderCache[k] = v;
}

export function renderCacheGet(k) {
    return renderCache[k];
}

// currently-rendered imageData in canvas
let renderedImage = null;

export function setRenderedImage(img, context=defaultCtx) {
    renderedImage = img;
    context.putImageData(img, 0, 0);
}

export function getRenderedImage() {
    return renderedImage;
}

// resized image with no effects applied
let resizedOriginalImage = null;

export function setResizedOriginalImage(img) {
    resizedOriginalImage = img;
    clearNormedImage();
}

export function getResizedOriginalImage() {
    return resizedOriginalImage;
}

// uploaded image as HTMLImageElement, used to generate resized
// raster in canvas before applying effects
let originalImage = null;

export function setOriginalImage(img) {
    originalImage = img;
}

export function getOriginalImage() {
    return originalImage;
}

const renderCanvas = document.createElement("canvas");
export const renderer = new GlitchRenderer(renderCanvas);

let normedImage = null;
let normLoadID = '';

export function getNormLoadID() {
    return normLoadID;
}

export function rerollNormLoadID() {
    normLoadID = uuidv4();
}

export function getNormedImage() {
    if (!resizedOriginalImage) return null;
    if (normedImage === null) {
        normedImage = normalizeImageData(resizedOriginalImage);
        normLoadID = uuidv4();
        return normedImage;
    } else return normedImage;
}

export function clearNormedImage() {
    normedImage = null;
}

// canvas property modification

export function setFilters(filters, cvs=canvas) {
    cvs.style.filter = filters;
}

export function makeEffectInstance(mod) {
    if (!mod) return Promise.resolve();
    let instance = {
        id: uuidv4(),
        name: mod.name,
        config: structuredClone(mod.defaultConfig),
        uiLayout: mod.uiLayout,
        disabled: false,
        styleHook: mod.styleHook,
        cleanupHook: mod.cleanupHook,
        apply: mod.apply,
        label: mod.name,
        solo: false,
        isGPU: mod.isGPU
    }
    if (mod.isGPU) {
        instance.glState = new webGLState(renderer, mod.fragURL)
    }
    const hook = mod.initHook?.(instance, renderer);
    instance.ready = hook?.then ? hook : Promise.resolve();
    return instance;
}

// state save/load

export function saveState() {
    return getEffectStack().map(effect => ({
        name: effect.name,
        config: { ...effect.config }
    }))
}

export async function loadState(preset, registry, fromJSON=true) {
    if (fromJSON) {
        try {
            preset = JSON.parse(preset);
        } catch (err) {
            alert(`Failed to load effect: ${err}.`);
            return;
        }
    } else {
        preset = preset.config;
    }
    flushEffectStack();
    for (const { name, config } of preset) {
        const mod = registry[name];
        if (!mod) {
            console.warn(`Unknown effect: ${name}`);
            continue;
        }
        const instance = makeEffectInstance(mod);
        await instance.ready;
        instance.config = { ...mod.defaultConfig, ...config };
        addEffectToStack(instance);
    }
}


function DefaultDict(defaultFactory) {
  return new Proxy({}, {
    get(target, prop) {
      if (!(prop in target)) {
        target[prop] = defaultFactory();
      }
      return target[prop];
    }
  });
}

function NestingDictFactory() {
    return () => DefaultDict(NestingDictFactory());
}

function NestingDict() {
    return DefaultDict(NestingDictFactory());
}

export const uiState = NestingDict();

export function resizeAndRedraw() {
    const originalImage = getOriginalImage();
    if (!originalImage) return;
    const leftPane = document.getElementById('leftPane');
    const width = leftPane.clientWidth - 20;
    const height = window.innerHeight * 0.9;
    let scale = Math.min(
        width / originalImage.width, height / originalImage.height
    );

    const w = Math.floor(originalImage.width * scale);
    const h = Math.floor(originalImage.height * scale);

    canvas.width = w;
    canvas.height = h;

    defaultCtx.drawImage(originalImage, 0, 0, w, h);
    setRenderedImage(defaultCtx.getImageData(0, 0, w, h));
    setResizedOriginalImage(defaultCtx.getImageData(0, 0, w, h));
    clearNormedImage();
    requestRender();
}

// TODO: big gun type situation
export function resetStack() {
    setFreezeAnimationFlag(true);
    try {
        forEachEffect(
            (fx) => {
                if (fx.cleanupHook) {
                    fx.cleanupHook(fx);
                }
            })
        flushEffectStack();
        clearRenderCache();
        requestUIDraw();
        requestRender();
    } finally {
        setFreezeAnimationFlag(false);
    }
}