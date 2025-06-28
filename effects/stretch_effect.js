// effects/stretch_effect.js

import {channelwise, normalizeRange, percentileClip, stddevClip} from '../stretch.js';

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Stretch",

    defaultConfig: {
        method: "percentile", // "minmax", "stddev"
        paramA: 1.0,           // For percentile: lower percentile, for stddev: sigma
        paramB: 99.0,          // For percentile: upper percentile
        channelwise: true
    },

    apply(imageData, config) {
        const { data, width, height } = imageData;
        let func, params, result;

        switch (config.method) {
            case "stddev":
                func = stddevClip;
                params = [config.paramA];
                break;
            case "minmax":
                func = normalizeRange;
                params = [];
                break;
            case "percentile":
                func = percentileClip;
                params = [config.paramA, config.paramB];
        }
        if (config.channelwise) {
            result = channelwise(data, width, height, func, ...params);
        } else {
            result = func(data, ...params);
        }
        return new ImageData(result, width, height);

    },

    uiLayout: [
        {
            type: "select",
            key: "method",
            label: "Stretch Method",
            options: [
                { value: "percentile", label: "Percentile Clip" },
                { value: "stddev", label: "Standard Deviation Clip" },
                { value: "minmax", label: "Min/Max Normalize" }
            ]
        },
        {
            type: "range",
            key: "paramA",
            label: "Param A",
            min: 1,
            max: 100,
            step: 0.5
        },
        {
            type: "range",
            key: "paramB",
            label: "Param B",
            min: 1,
            max: 100,
            step: 0.5
        },
        {
            type: "checkbox",
            key: "channelwise",
            label: "Channelwise"
        }
    ]
};
