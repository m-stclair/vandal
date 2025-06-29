import {canvas, ctx} from "./ui.js";
import {gid, uuidv4} from "./utils/helpers.js";

let effectStack = [];

export function forEachEffect(cb) {
    return effectStack.forEach(cb);
}

export function filterEffectStack(func) {
    effectStack = effectStack.filter(func);
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

const renderCache = new Map();

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

export function setRenderedImage(img) {
    renderedImage = img;
    ctx.putImageData(img, 0, 0);
}

export function getRenderedImage() {
    return renderedImage;
}

// resized image with no effects applied
let resizedOriginalImage = null;

export function setResizedOriginalImage(img) {
    resizedOriginalImage = img;
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


// canvas property modification

export function setFilters(filters) {
    canvas.style.filter = filters;
}

// config UI clearing

const configContainer = gid("configForm");

export function clearConfigUI() {
    configContainer.innerHTML = '';
}

export function makeEffectInstance(mod) {
    if (!mod) return;
    const instance = {
        id: uuidv4(),
        name: mod.name,
        config: structuredClone(mod.defaultConfig),
        uiLayout: mod.uiLayout,
        disabled: false,
        styleHook: mod.styleHook,
        cleanupHook: mod.cleanupHook,
        apply: mod.apply,
    }
    if (mod.initHook) mod.initHook(instance);
    return instance;
}

// state save/load

export function saveState() {
    return JSON.stringify(
        getEffectStack().map(effect => ({
            name: effect.name,
            config: { ...effect.config }
        })),
        null,
        2
    );
}

export function loadState(jsonText, registry) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch (err) {
        alert("Invalid JSON.");
        return;
    }
    flushEffectStack();

    for (const { name, config } of parsed) {
        const mod = registry[name];
        if (!mod) {
            console.warn(`Unknown effect: ${name}`);
            continue;
        }
        const instance = makeEffectInstance(mod);
        instance.config = { ...mod.defaultConfig, ...config };
        addEffectToStack(instance);
    }
}