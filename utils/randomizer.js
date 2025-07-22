import {effectRegistry} from "../registry.js";
import {
    addEffectToStack,
    flushEffectStack,
    makeEffectInstance,
    requestRender,
    requestUIDraw,
    setFreezeAnimationFlag
} from "../state.js";
import {BlendModeEnum, BlendTargetEnum, ColorspaceEnum} from "./glsl_enums.js";
import {FieldDisplayModeEnum} from "../effects/fieldParentheses.js";


const ANIMATE_PROB = 0.25;  // chance to animate an eligible param

function generateAnimationMod(base, min, max) {
    const span = max - min;
    const freq = +(Math.random() * 0.1 + 0.01).toFixed(3); // 0.01–0.11 Hz
    const scale = +(Math.random() * 0.5 * span).toFixed(2); // up to 50% swing
    const offset = base;
    const type = weightedSample([
        ['sine', 3],
        ['triangle', 1],
        ['saw', 0.5],
        ['fm-lfo', 1],
        ['square', 0.1],
        ['hold', 0.5],
        ['walk', 0.5],
        ['impulse-ease', 0.5],
        ['impulse', 0.25],
    ]);
    return {type, freq, phase: 0, scale, offset};
}


const blendWeights = {
    [ColorspaceEnum.MIX]: 5.0,
    [ColorspaceEnum.SOFT_LIGHT]: 2.0,
    [ColorspaceEnum.HARD_LIGHT]: 0.5,
    [ColorspaceEnum.DARKEN]: 0.5,
    [ColorspaceEnum.REPLACE]: 0.0
}

const chanWeights = {
    [BlendTargetEnum.ALL]: 10.0
}

const fieldDisplayWeights = {
    [FieldDisplayModeEnum.STRENGTH]: 1.5,
    [FieldDisplayModeEnum.ATTENUATE]: 3,
    [FieldDisplayModeEnum.TINT]: 0.5,
    [FieldDisplayModeEnum.CHROMA_BOOST]: 0.25,
    [FieldDisplayModeEnum.HILLSHADE]: 0.25,
    [FieldDisplayModeEnum.EDGE]: 0.75,
}

const weightTable = {
    BLENDMODE: blendWeights,
    BLEND_CHANNEL_MODE: chanWeights,
    FIELD_DISPLAY_MODE: fieldDisplayWeights
}

function roll1d4() {
    return Math.floor(Math.random() * 4) + 1;
}

function pickRandomSubset(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

function pickRandomSubsetWithReplacement(arr, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        out.push(shuffled[0]);
    }
    return out;
}

function randBetween(min, max, steps = 100) {
    const step = (max - min) / steps;
    return min + step * Math.floor(Math.random() * steps);
}

function getBaseValue(param) {
    return (param && typeof param === 'object' && 'value' in param) ? param.value : param;
}

function setBaseValue(param, newVal) {
    if (param && typeof param === 'object') {
        const newMod = structuredClone(param.mod);
        newMod.offset = newVal;
        param.mod = newMod
        return param;
    } else {
        return newVal;
    }
}

function enforceBlendConstraints(config) {
    if (config.BLENDMODE === BlendModeEnum.REPLACE) {
        config.BLENDMODE = BlendModeEnum.MIX;
    }
    let blendAmount = getBaseValue(config.blendAmount);
    if (blendAmount !== undefined) {
        if (blendAmount < 0.35) {
            config.blendAmount = setBaseValue(config.blendAmount, 0.35);
        } else if (config.BLENDMODE === BlendModeEnum.MIX && blendAmount > 0.75) {
            config.blendAmount = setBaseValue(config.blendAmount, 0.75);
        }
    } else {
        // harmless to set it on things that don't need it
        blendAmount = 1;
    }
    if (
        [BlendModeEnum.DIFFERENCE, BlendModeEnum.ADD].includes(config.BLENDMODE)
        && [ColorspaceEnum.Lab, ColorspaceEnum.LCH, ColorspaceEnum.YCbCr].includes(config.COLORSPACE)
    ) {
        config.BLENDMODE = BlendModeEnum.SOFT_LIGHT
    }
    if (
        (config.BLEND_CHANNEL_MODE === BlendTargetEnum.CHANNEL_2)
        && [ColorspaceEnum.HSV, ColorspaceEnum.LCH, ColorspaceEnum.HSL].includes(config.COLORSPACE)
    ) {
        config.BLEND_CHANNEL_MODE = BlendTargetEnum.ALL
    }
   let chromaBoost = getBaseValue(config.chromaBoost);
    if (chromaBoost !== undefined) {
        const clamped = Math.min(Math.max(0.9, blendAmount), 1.1);
        config.chromaBoost = setBaseValue(config.chromaBoost, clamped);
    }
}

function flattenUiLayout(layout) {
    const out = [];

    for (const param of layout || []) {
        const ptype = (param.type || "").toLowerCase();
        if (ptype === "group") {
            out.push(...flattenUiLayout(param.children));
        } else {
            out.push(param);
        }
    }
    return out;
}

function weightedSample(weightedValues) {
    const totalWeight = weightedValues.reduce((acc, [_, w]) => acc + w, 0);
    const r = Math.random() * totalWeight;
    let acc = 0;
    for (const [value, weight] of weightedValues) {
        acc += weight;
        if (r < acc) return value;
    }
    // fallback
    return weightedValues[weightedValues.length - 1][0];
}


function weightedSampleFromOptions(options, weightMap) {
    const weighted = options.map(opt => [
        opt.value ?? opt,
        weightMap[opt.value ?? opt] ?? 1.0
    ]);
    return weightedSample(weighted);
}

function validateConfig(config, layout) {
    const errors = [];
    const flatParams = flattenUiLayout(layout);

    for (const param of flatParams) {
        const key = param.key;
        const val = config[key];

        if (val === undefined) {
            errors.push(`${key} is missing`);
            continue;
        }

        if (typeof val === 'number' && isNaN(val)) {
            errors.push(`${key} is NaN`);
        }

        if (typeof val === 'object' && val !== null && 'value' in val) {
            const base = val.value;
            const mod = val.mod;

            if (typeof base !== 'number' || isNaN(base)) {
                errors.push(`${key}.value is NaN or not a number`);
            }

            if (mod) {
                const requiredFields = ['type', 'freq', 'phase', 'scale', 'offset'];
                for (const field of requiredFields) {
                    const v = mod[field];
                    if (v === undefined || (typeof v === 'number' && isNaN(v))) {
                        errors.push(`${key}.mod.${field} is ${v}`);
                    }
                }
            }
        }
    }

    return errors;
}

function generateRandomizedConfig(layout, meta) {
    const config = {};
    const flatParams = flattenUiLayout(layout);
    const hints = meta.parameterHints ?? {};
    for (const param of flatParams || []) {
        if (hints[param.key]?.always) {
            config[param.key] = hints[param.key].always;
            continue;
        }
        const ptype = param.type.toLowerCase();
        if (ptype === "modslider" || ptype === "range") {
            const min = hints[param.key]?.min ?? param.min;
            const max = hints[param.key]?.max ?? param.max;
            let val = randBetween(min, max);
            if (!val && !(val === 0)) {
                throw new Error("NAN!!!");
            }
            if (param.scale === "log") {
                const scaleFactor = param.scaleFactor ?? 10;
                val = Math.log(val) / Math.log(scaleFactor)
            }
            if (param.step === 1) val = Math.floor(val);

            if (ptype === "modslider" && Math.random() < ANIMATE_PROB) {
                config[param.key] = {
                    value: val,
                    mod: generateAnimationMod(val, min, max)
                };
            } else {
                config[param.key] = val;
            }

        } else if (ptype === "checkbox") {
            config[param.key] = Math.random() < 0.5;
        } else if (ptype === "select") {
            config[param.key] = weightedSampleFromOptions(
                param.options.map(opt => opt.value ?? opt),
                weightTable[param.key] ?? {}
            );

        } else if (ptype === "vector") {
            let vec = [];
            vec = [];
            for (let i = 0; i < (param.length ?? param.subLabels.length); i++) {
                vec.push(randBetween(param.min, param.max));
            }
            while (param.max <= 2 && (!vec.some((v) => v > 0.2) || !vec.some((v) => v < 0.8))) {
                // this is a silly heuristic: "don't turn all the colors to black "
                // or white, although these aren't all colors"
                // TODO: DRY, michael, DRY
                vec = [];
                for (let i = 0; i < (param.length ?? param.subLabels.length); i++) {
                    vec.push(randBetween(param.min, param.max));
                }
            }
            config[param.key] = vec;
        } else {
            throw new Error("invalid parameter specification")
        }
    }
    return config;
}


export async function randomizeEffectStack() {
    setFreezeAnimationFlag(true);
    flushEffectStack();

    const allEffects = Object.values(effectRegistry)
        .filter(e => e.meta?.realtimeSafe && e.isGPU && !e.meta?.notInRandom);
    const numEffects = roll1d4();

    const selected = pickRandomSubsetWithReplacement(allEffects, numEffects);

    for (const effect of selected) {
        const fx = makeEffectInstance(effect)
        fx.config = generateRandomizedConfig(fx.uiLayout, effect.meta);
        enforceBlendConstraints(fx.config);
        const errors = validateConfig(fx.config, fx.uiLayout);
        if (errors.length > 0) {
            console.error(`invalid random config for ${fx.name}`);
            console.error(errors);
        }
        console.log(`random config for ${fx.name}`);
        console.log(fx.config);
        await fx.ready;
        addEffectToStack(fx);
    }
    setFreezeAnimationFlag(false);
    requestUIDraw();
    requestRender();
}
