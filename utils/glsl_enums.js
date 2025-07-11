export const BlendModes = {
  REPLACE: 0,
  MIX: 1,
  ADD: 2,
  MULTIPLY: 3,
  SCREEN: 4,
  OVERLAY: 5,
  DARKEN: 6,
  LIGHTEN: 7,
  DIFFERENCE: 8,
  SOFT_LIGHT: 9,
  HARD_LIGHT: 10
};

export const BlendModeNames = {
  0: 'Replace',
  1: 'Mix',
  2: 'Add',
  3: 'Multiply',
  4: 'Screen',
  5: 'Overlay',
  6: 'Darken',
  7: 'Lighten',
  8: 'Difference',
  9: 'Soft Light',
 10: 'Hard Light'
};

export let BlendOpts = [];

Object.entries(BlendModeNames).forEach(([k, v]) => {
    BlendOpts.push({'label': v, 'value': k});
})


export const ColorspaceNames = {
    0: 'RGB',
    1: 'Lab',
    2: 'LCH',
    3: 'HSV'
}

export let ColorspaceOpts = [];
Object.entries(ColorspaceNames).forEach(([k, v]) => {
    ColorspaceOpts.push({'label': v, 'value': k});
})

export const PosterizeModes = {
  NONE: 0,
  UNIFORM: 1,
  LOG: 2,
  BIAS: 3,
  BAYER: 4
};

export const PosterizeModeNames = {
    0: 'None',
    1: 'Uniform',
    2: 'Log',
    3: 'Bias',
    4: 'Bayer'
}

export let PosterizeModeOpts = [];
Object.entries(PosterizeModeNames).forEach(([k, v]) => {
    PosterizeModeOpts.push({'label': v, 'value': k});
})
