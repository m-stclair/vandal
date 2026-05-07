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
    let freq = +(Math.random() * 0.09 + 0.03).toFixed(3); // 0.03–0.12 Hz
    let scale = +(Math.random() * 0.5 * span).toFixed(2); // up to 50% swing
    const offset = base;
    const type = weightedSample([
        ['sine', 3],
        ['triangle', 1],
        ['saw', 1],
        ['fm-lfo', 1],
        ['square', 0.1],
        ['hold', 0.5],
        ['walk', 0.5],
        ['impulse-ease', 0.5],
        ['impulse', 0.25],
    ]);
    if (['impulse-ease', 'impulse', 'walk'].includes(type)) {
        freq *= 3;

    }
    if (['impulse-ease', 'impulse'].includes(type)) {
        scale *= 1.5;
    }
    return {type, freq, phase: 0, scale, offset};
}


const blendWeights = {
    [BlendModeEnum.MIX]: 6.0,
    [BlendModeEnum.SOFT_LIGHT]: 2.5,
    [BlendModeEnum.HARD_LIGHT]: 2.0,
    [BlendModeEnum.SOFT_LIGHT_I]: 4.0,
    [BlendModeEnum.DARKEN]: 0.5,
    [BlendModeEnum.MULTIPLY]: 0.5,
    [BlendModeEnum.POWER]: 0.5,
    [BlendModeEnum.REPLACE]: 0.0
}

const cSpaceWeights = {
    [ColorspaceEnum.RGB]: 3.0,
    [ColorspaceEnum.HSV]: 2.0,
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
    FIELD_DISPLAY_MODE: fieldDisplayWeights,
    COLORSPACE: cSpaceWeights,
}

function roll1d4() {
    return Math.floor(Math.random() * 4) + 1;
}

function pickRandomSubsetWithReplacement(arr, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(arr[Math.floor(Math.random() * arr.length)]);
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

const PERMISSIBLE_NON_MIX_BLENDS = new Map([
    [ColorspaceEnum.Lab, [
        BlendModeEnum.OVERLAY, BlendModeEnum.DARKEN, BlendModeEnum.LIGHTEN,
        BlendModeEnum.SOFT_LIGHT, BlendModeEnum.HARD_LIGHT,
        BlendModeEnum.SOFT_LIGHT_I, BlendModeEnum.HARD_LIGHT_I,
        BlendModeEnum.VIVID_LIGHT, BlendModeEnum.POWER
    ]],
    [ColorspaceEnum.YCbCr, [
        BlendModeEnum.OVERLAY, BlendModeEnum.DARKEN, BlendModeEnum.LIGHTEN,
        BlendModeEnum.SOFT_LIGHT, BlendModeEnum.HARD_LIGHT,
        BlendModeEnum.SOFT_LIGHT_I, BlendModeEnum.HARD_LIGHT_I,
        BlendModeEnum.VIVID_LIGHT, BlendModeEnum.POWER
    ]],
    [ColorspaceEnum.JCHz, [
        BlendModeEnum.DARKEN, BlendModeEnum.LIGHTEN, BlendModeEnum.DIFFERENCE,
        BlendModeEnum.COLOR_DODGE, BlendModeEnum.OVERLAY,
        BlendModeEnum.SCREEN, BlendModeEnum.ADD, BlendModeEnum.MULTIPLY,
        BlendModeEnum.SOFT_LIGHT, BlendModeEnum.HARD_LIGHT,
        BlendModeEnum.SOFT_LIGHT_I, BlendModeEnum.HARD_LIGHT_I,

    ]],
    [ColorspaceEnum.JzAzBz, [
        BlendModeEnum.DARKEN, BlendModeEnum.LIGHTEN, BlendModeEnum.OVERLAY,
        BlendModeEnum.SOFT_LIGHT, BlendModeEnum.HARD_LIGHT,
        BlendModeEnum.SOFT_LIGHT_I, BlendModeEnum.HARD_LIGHT_I,
        BlendModeEnum.POWER
    ]],
    [ColorspaceEnum.Opponent, [
        BlendModeEnum.ADD, BlendModeEnum.MULTIPLY, BlendModeEnum.SCREEN,
        BlendModeEnum.OVERLAY, BlendModeEnum.DARKEN, BlendModeEnum.LIGHTEN,
        BlendModeEnum.DIFFERENCE,  BlendModeEnum.SOFT_LIGHT, BlendModeEnum.HARD_LIGHT,
        BlendModeEnum.COLOR_DODGE
    ]]
])

const CHROMA_SECOND_CHANNEL_SPACES = [
    ColorspaceEnum.HSV, ColorspaceEnum.HSL, ColorspaceEnum.JCHz, ColorspaceEnum.LCH
]

const FULL_OPACITY_DEFAULT_CHANCE = 1 / 3;

function enforceBlendConstraints(config, meta) {
    if (!Object.keys(config).includes("blendAmount")) {
        // effect does not use full blend system and might use color conversion
        // or parts of the blend system for other purposes; don't mess with it
        return;
    }
    const fullOpacityChance = meta.fullOpacityChance ?? FULL_OPACITY_DEFAULT_CHANCE;
    if (Math.random() <= fullOpacityChance) {
        config.BLENDMODE = BlendModeEnum.MIX;
        config.blendAmount = 1.0;
        config.BLEND_CHANNEL_MODE = BlendTargetEnum.ALL;
        config.COLORSPACE = ColorspaceEnum.RGB;
        return;
    }
    if (config.BLENDMODE === BlendModeEnum.REPLACE) {
        config.BLENDMODE = BlendModeEnum.MIX;
    }
    let blendAmount = getBaseValue(config.blendAmount);
    if (
        CHROMA_SECOND_CHANNEL_SPACES.includes(config.COLORSPACE)
        && config.BLEND_CHANNEL_MODE === 2
    ) {
        config.BLEND_CHANNEL_MODE = 0;
    }
    if (
        PERMISSIBLE_NON_MIX_BLENDS.has(config.COLORSPACE)
        && !PERMISSIBLE_NON_MIX_BLENDS.get(config.COLORSPACE).includes(config.BLENDMODE)
        // this last one works because in practice everything in PERMISSIBLE_NON_MIX_BLENDS
        // has lightness on channel 1. if that stops being true, this heuristic needs to get
        // more complicated.
        && config.BLEND_CHANNEL_MODE !== 1
    ) {
        config.BLENDMODE = BlendModeEnum.MIX;
    }
    if (blendAmount !== undefined) {
        if (blendAmount < 0.35) {
            config.blendAmount = setBaseValue(config.blendAmount, 0.35);
        } else if (config.BLENDMODE === BlendModeEnum.MIX && blendAmount > 0.8) {
            config.blendAmount = setBaseValue(config.blendAmount, 0.8);
        }
    } else {
        // harmless to set it on things that don't need it
        config.blendAmount = 1;
    }

}

function flattenUiLayout(layout) {
    const out = [];

    for (const param of layout || []) {
        const ptype = (param.type || "").toLowerCase();
        if (ptype === "group") {
            out.push(...flattenUiLayout(param.children));
        } else if (ptype !== "button") {
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

function selectRandomParam(hints, param) {
    if (hints[param.key]?.always) {
        return hints[param.key].always;
    }
    const ptype = param.type.toLowerCase();
    if (ptype === "modslider" || ptype === "range") {
        const min = hints[param.key]?.min ?? param.min;
        const max = hints[param.key]?.max ?? param.max;
        let val = randBetween(min, max);
        if (param.step === 1) val = Math.floor(val);

        if (ptype === "modslider" && Math.random() < ANIMATE_PROB) {
            const aniMin = hints[param.key]?.aniMin ?? min;
            const aniMax = hints[param.key]?.aniMax ?? max;
            return {
                value: val,
                mod: generateAnimationMod(val, aniMin, aniMax)
            };
        } else {
            return val;
        }
    } else if (ptype === "checkbox") {
        return Math.random() < 0.5;
    } else if (ptype === "select") {
        return weightedSampleFromOptions(
            param.options.map(opt => opt.value ?? opt),
            {...(weightTable[param.key] ?? {}), ...(hints[param.key]?.weights ?? {})}
        );
    } else if (ptype === "palette") {
        return structuredClone(param.defaultValue ?? param.fallbackPalette ?? []);
    } else if (ptype === "vector") {
        let vec = [];
        const min = hints[param.key]?.min ?? param.min;
        const max = hints[param.key]?.max ?? param.max;
        for (let i = 0; i < (param.length ?? param.subLabels.length); i++) {
            vec.push(randBetween(min, max));
        }
        while (param.max <= 2 && ((!vec.some((v) => v > 0.2) && max > 0.2)) || (!vec.some((v) => v < 0.8)) && min < 0.8) {
            // this is a silly heuristic: "don't turn all the colors to black "
            // or white, although these aren't all colors"
            // TODO: DRY, michael, DRY
            vec = [];
            for (let i = 0; i < (param.length ?? param.subLabels.length); i++) {
                vec.push(randBetween(min, max));
            }
        }
        return vec;
    } else {
        throw new Error("invalid parameter specification")
    }
}

function filterKeys(obj, arr) {
    return Object.fromEntries(
        Object.entries(obj).filter(([k, _v]) => arr.includes(k))
    );
}

export function generateRandomizedConfig(layout, meta) {
    const config = {};
    const flatParams = flattenUiLayout(layout);
    const hints = meta.parameterHints ?? {};
    for (const param of flatParams || []) {
        config[param.key] = selectRandomParam(hints, param, config);
    }
    if (hints.notAll0) {
        let filtered = filterKeys(config, hints.notAll0);
        while (Object.values(filtered).every((v) => !v)) {
            for (const k of hints.notAll0) {
                config[k] = Math.random() < 0.5;
            }
            filtered = filterKeys(config, hints.notAll0);
        }
    }
    return config;
}

let randomizingFlag = false;

export function randomizeConfig(fx, effect) {
    const config = generateRandomizedConfig(fx.uiLayout, effect.meta);
    enforceBlendConstraints(config, effect.meta);
    const errors = validateConfig(config, fx.uiLayout);
    if (errors.length > 0) {
        console.error(`invalid random config for ${fx.name}`);
        console.error(errors);
        return;
    }
    console.log(`random config for ${fx.name}`);
    console.log(config);
    fx.config = config;
}

export async function randomizeEffectStack() {
    if (randomizingFlag) return;
    randomizingFlag = true;
    try {
        setFreezeAnimationFlag(true);
        flushEffectStack();

        const allEffects = Object.values(effectRegistry)
            .filter(e => e.meta?.realtimeSafe && e.isGPU && !e.meta?.notInRandom);
        const numEffects = roll1d4();

        const selected = pickRandomSubsetWithReplacement(allEffects, numEffects);
        for (const effect of selected) {
            const fx = makeEffectInstance(effect)
            randomizeConfig(fx, effect);
            await fx.ready;
            addEffectToStack(fx);
        }
        requestUIDraw();
        requestRender();
    } finally {
        setFreezeAnimationFlag(false);
        randomizingFlag = false;
    }
}