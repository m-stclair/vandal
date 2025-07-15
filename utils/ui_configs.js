import {BlendModeOpts, BlendTargetOpts, ColorspaceOpts, ZoneShapeOpts} from "./glsl_enums.js";

export function blendControls() {
    return {
            type: 'group',
            color: "#1a0011",
            collapsed: true,
            label: 'Blend Options',
            kind: 'collapse',
            children: [
                {key: "blendAmount", label: "Blend", type: "modSlider", min: 0, max: 1, step: 0.01},
                {key: 'BLENDMODE', label: 'Blend Mode', type: 'Select', options: BlendModeOpts},
                {key: 'COLORSPACE', label: 'Blend Colorspace', type: 'Select', options: ColorspaceOpts},
                {key: 'BLEND_CHANNEL_MODE', label: 'Blend Target', type: 'Select', options: BlendTargetOpts}
            ]
        }
}

export function zoneControls() {
    return {
        type: 'group',
        kind: 'collapse',
        label: 'Zone Settings',
        color: '#002233',
        children: [
            {
                type: "select",
                key: "ZONESHAPE",
                label: "Zone Shape",
                options: ZoneShapeOpts
            },
            {type: "modSlider", key: "zoneCX", label: "Zone Center X", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneSX", label: "Zone Scale X", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneCY", label: "Zone Center Y", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneSY", label: "Zone Scale Y", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneSoftness", label: "Zone Softness", min: 0, max: 1, steps: 200},
            {type: "modSlider", key: "zoneAngle", label: "Zone Angle", min: 0, max: Math.PI * 2, steps: 200},
            {
                type: "modSlider",
                key: "zoneEllipseN",
                label: "Superellipse Shape Parameter",
                min: 0.9,
                max: 10,
                steps: 200
            },
        ]
    }
}

export const group = (label, children, options = {}) => ({
    type: 'group',
    label,
    kind: 'collapse',
    ...options,
    children
});