// Built-in per-plugin config presets (not stored in localStorage)
//
// Shape:
// export const builtInPluginPresets = {
//     "Effect Name": {
//         "Preset Label": { /* config values for that one effect */ }
//     }
// };
//
// User-saved plugin presets are merged on top of this map in utils/presets.js.

import {builtInPresets} from "./app.js";

export const builtInPluginPresets = {
    "Channel Mixer": {
        "Swap 2-3": {"mix2": [0, 0, 1], "mix3": [0, 1, 0], "COLORSPACE": "7"}
    },
    "Edge Trace": {
        "Black Trace": {"threshold": 0.1, "tint": [0, 0, 0], "baseOpacity": 1}
    },
    "Palette Synth": {
        "Dungeon": {
            "paletteMode": "manual",
            "manualPalette": [{"color": "#000000", "locked": false}, {
                "color": "#0000aa",
                "locked": false
            }, {"color": "#00aaaa", "locked": false}, {"color": "#1c2818", "locked": false}, {
                "color": "#344028",
                "locked": false
            }, {"color": "#586838", "locked": false}, {"color": "#889060", "locked": false}, {
                "color": "#882030",
                "locked": false
            }, {"color": "#d8a838", "locked": false}, {"color": "#287058", "locked": false}, {
                "color": "#4080a8",
                "locked": false
            }, {"color": "#aa00aa", "locked": false}, {"color": "#aa5500", "locked": false}, {
                "color": "#aaaaaa",
                "locked": false
            }, {"color": "#2a1a12", "locked": false}, {"color": "#442818", "locked": false}, {
                "color": "#663820",
                "locked": false
            }, {"color": "#884c28", "locked": false}, {"color": "#b86838", "locked": false}, {
                "color": "#d89050",
                "locked": false
            }, {"color": "#ffd080", "locked": false}, {"color": "#ffffff", "locked": false}, {
                "color": "#181028",
                "locked": false
            }, {"color": "#2a1f48", "locked": false}, {"color": "#443868", "locked": false}, {
                "color": "#6858a0",
                "locked": false
            }, {"color": "#8c80c0", "locked": false}],
            "manualInitPalette": "vgaDungeon",
            "manualInitSize": 15,
            "paletteSize": 15,
            "assignMode": "dither",
            "outputMode": "fullReplace",
            "blockSize": 3,
            "ditherPattern": "ordered4",
            "ditherAngle": 45,
            "ditherLumaAmount": 1,
            "ditherScale": 4,
        }
    },

};

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function uniqueLabel(existing, desired) {
    if (!hasOwn(existing, desired)) return desired;

    let i = 2;
    while (hasOwn(existing, `${desired} (${i})`)) i++;
    return `${desired} (${i})`;
}

function addPluginPreset(presets, effectName, label, config) {
    if (!effectName || !label || config === undefined) return;

    if (!presets[effectName]) presets[effectName] = {};
    presets[effectName][uniqueLabel(presets[effectName], label)] = config;
}

function appPresetLabel(appPreset, effectName, seenInStack) {
    const base = "α: " + appPreset?.name || "Built-in preset";
    const count = seenInStack[effectName] || 0;
    seenInStack[effectName] = count + 1;

    return count === 0 ? base : `${base} #${count + 1}`;
}

export function derivePluginPresetsFromAppPresets(appPresets = builtInPresets) {
    const presets = {};

    for (const appPreset of appPresets) {
        const stack = Array.isArray(appPreset?.config) ? appPreset.config : [];
        const seenInStack = {};

        for (const entry of stack) {
            if (!entry?.name || entry?.config === undefined) continue;

            addPluginPreset(
                presets,
                entry.name,
                appPresetLabel(appPreset, entry.name, seenInStack),
                entry.config
            );
        }
    }

    return presets;
}

export const builtInAppDerivedPluginPresets = derivePluginPresetsFromAppPresets();