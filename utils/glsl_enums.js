/**
 * @param {string[]} names
 * @returns {{
 *   enum: Record<string, number>,
 *   names: Record<number, string>,
 *   options: { label: string, value: number }[]
 * }}
 */
function makeEnum(names) {
    const e = {};
    const namesMap = {};
    names.forEach((name, i) => {
        e[name] = i;
        namesMap[i] = name;
    });
    const opts = names.map((name, i) => ({label: name, value: i}));
    return {
        enum: Object.freeze(e),
        names: Object.freeze(namesMap),
        options: Object.freeze(opts)
    };
}

export const {
    enum: ColorspaceEnum,
    names: ColorspaceNames,
    options: ColorspaceOpts
} = makeEnum([
    'RGB',
    'Lab',
    'LCH',
    'HSV',
    'Opponent',
    'YCbCr',
    'HSL'
]);

// Blend modes
export const {
    enum: BlendModeEnum,
    names: BlendModeNames,
    options: BlendModeOpts
} = makeEnum([
    'REPLACE',
    'MIX',
    'ADD',
    'MULTIPLY',
    'SCREEN',
    'OVERLAY',
    'DARKEN',
    'LIGHTEN',
    'DIFFERENCE',
    'SOFT_LIGHT',
    'HARD_LIGHT'
]);

// Posterize modes
export const {
    enum: PosterizeEnum,
    names: PosterizeModeNames,
    options: PosterizeModeOpts
} = makeEnum([
    'NONE',
    'UNIFORM',
    'LOG',
    'BIAS',
    'BAYER'
]);

// Blend targets
export const {
    enum: BlendTargetEnum,
    names: BlendTargetNames,
    options: BlendTargetOpts
} = makeEnum([
    'ALL',
    'LUMA',
    'HUE',
    'SATURATION',
    'VALUE'
]);

// Gate modes
export const {
    enum: GateModeEnum,
    names: GateModeNames,
    options: GateModeOpts
} = makeEnum([
    'NONE',
    'SOFT',
    'HARD',
    'BURST'
]);


// Zone shapes
export const {
    enum: ZoneShapeEnum,
    names: ZoneShapeNames,
    options: ZoneShapeOpts
} = makeEnum([
    'BOX',
    'VERTICAL',
    'SUPERELLIPSE',
    'HORIZONTAL'
]);