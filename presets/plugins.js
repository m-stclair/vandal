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
    // Add hand-curated plugin presets here when a preset should ship independently
    // of any full-stack app preset.
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
    const base = appPreset?.name || "Built-in preset";
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