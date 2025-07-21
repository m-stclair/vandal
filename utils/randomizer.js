import {effectRegistry} from "../registry.js";
import {
    addEffectToStack,
    flushEffectStack,
    makeEffectInstance,
    requestRender,
    requestUIDraw,
    setFreezeAnimationFlag
} from "../state.js";
import {BlendModeEnum} from "./glsl_enums.js";

const blendWeights = [
    ["MIX", 5.0],
    ["SOFT_LIGHT", 2.0],
    ["MULTIPLY", 0.5],
    ["DARKEN", 0.5],
    ["REPLACE", 0.0]
];

const chanWeights = [
    ["ALL", 10.0]
]

const weightTable = {
    BLENDMODE: blendWeights,
    BLEND_CHANNEL_MODE: chanWeights
}

function roll1d4() {
    return Math.floor(Math.random() * 4) + 1;
}

function pickRandomSubset(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

function randBetween(min, max, steps = 100) {
    const step = (max - min) / steps;
    return min + step * Math.floor(Math.random() * steps);
}

function enforceBlendConstraints(config) {
    if (config.BLENDMODE === BlendModeEnum.REPLACE) {
        config.BLENDMODE = BlendModeEnum.MIX;
    }
    if (config.blendAmount !== undefined) {
        config.blendAmount = Math.min(0.95, Math.max(0.05, config.blendAmount));
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
        console.log(acc);
        if (r < acc) return value;
    }
    return weightedValues[weightedValues.length - 1][0]; // fallback
}


function weightedSampleFromOptions(options, weightMap) {
    const weighted = options.map(opt => [
        opt.value ?? opt,
        weightMap[opt.value ?? opt] ?? 1.0
    ]);
    return weightedSample(weighted);
}


function generateRandomizedConfig(layout, meta) {
    const config = {};
    const flatParams = flattenUiLayout(layout);
    const hints = meta.parameterHints ?? {};
    if (hints.length > 0) {
        console.log("hi");
    }
    for (const param of flatParams || []) {
        if (hints[param.key]?.always) {
            config[param.key] = hints[param.key].always;
            continue;
        }
        const ptype = param.type.toLowerCase();
        if (ptype === "modslider" || ptype === "range") {
            let val = randBetween(param.min, param.max);
            if (param.scale === "log") {
                const scaleFactor = param.scaleFactor ?? 10;
                val = Math.log(val) / Math.log(scaleFactor)
            }
            if (param.step === 1) val = Math.floor(val);
            config[param.key] = val;
        } else if (ptype === "checkbox") {
            config[param.key] = Math.random() < 0.5;
        } else if (ptype === "select") {
            config[param.key] = weightedSampleFromOptions(
                param.options.map(opt => opt.value ?? opt),
                weightTable[param.key] ?? {}
            );
            console.log(param.key);
            console.log(`had: ${param.options.map(opt => opt.value ?? opt)}`)
            console.log(`got: ${config[param.key]}`);

        } else if (ptype === "vector") {
            let vec = [];
            // this is a silly heuristic: "don't turn all the colors to black "
            // or white, although these aren't all colors"
            while (param.max <= 2 && (!vec.some((v) => v > 0.2) || !vec.some((v) => v < 0.8))) {
                vec = [];
                for (let i = 0; i < (param.length ?? param.subLabels.length); i++) {
                    vec.push(randBetween(param.min, param.max));
                }
            }
            config[param.key] = vec;
        } else {
            throw new Error("oops")
        }
        console.log(config);
    }
    return config;
}


function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


export async function randomizeEffectStack() {
    setFreezeAnimationFlag(true);
    flushEffectStack();

    const allEffects = Object.values(effectRegistry)
        .filter(e => e.meta?.realtimeSafe && e.isGPU);
    const numEffects = roll1d4();

    const selected = pickRandomSubset(allEffects, numEffects);

    for (const effect of selected) {
        const fx = makeEffectInstance(effect)
        fx.config = generateRandomizedConfig(fx.uiLayout, effect.meta);
        enforceBlendConstraints(fx.config);
        await fx.ready;
        addEffectToStack(fx);
    }
    setFreezeAnimationFlag(false);
    requestUIDraw();
    requestRender();
}
