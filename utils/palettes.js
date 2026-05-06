// Exact palette presets for palette synth. Values may be either:
//   - an array of hex strings, which loads the whole array exactly, or
//   - {size, colors}, which loads exactly the first `size` colors.
// These are deliberately separate from colormap LUTs: no resampling, no
// interpolation, no "helpful" color generation.

export const palettePresets = {
  amigaWorkbench: [
    "#000000", "#ffffff", "#0055aa", "#ff8800",
    "#223344", "#446688", "#88aacc", "#ffd2a0",
    "#aa5500", "#663300", "#cccccc", "#555555"
  ],
  amigaDemoscene: [
    "#000000", "#111133", "#332266", "#663399",
    "#aa44aa", "#ff66cc", "#ff9966", "#ffcc55",
    "#ffff99", "#88ffcc", "#44ccff", "#2288dd",
    "#115599", "#ffffff", "#777777", "#331122"
  ],
  commodore64: [
    "#000000", "#ffffff", "#880000", "#aaffee",
    "#cc44cc", "#00cc55", "#0000aa", "#eeee77",
    "#dd8855", "#664400", "#ff7777", "#333333",
    "#777777", "#aaff66", "#0088ff", "#bbbbbb"
  ],
  cgaBright: [
    "#000000", "#0000aa", "#00aa00", "#00aaaa",
    "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
    "#555555", "#5555ff", "#55ff55", "#55ffff",
    "#ff5555", "#ff55ff", "#ffff55", "#ffffff"
  ],
  egaClassic: [
    "#000000", "#0000aa", "#00aa00", "#00aaaa",
    "#aa0000", "#aa00aa", "#aa5500", "#aaaaaa",
    "#555555", "#5555ff", "#55ff55", "#55ffff",
    "#ff5555", "#ff55ff", "#ffff55", "#ffffff"
  ],
  zxSpectrum: [
    "#000000", "#0000d7", "#d70000", "#d700d7",
    "#00d700", "#00d7d7", "#d7d700", "#d7d7d7",
    "#0000ff", "#ff0000", "#ff00ff", "#00ff00",
    "#00ffff", "#ffff00", "#ffffff"
  ],
  msxTms9918: [
    "#000000", "#21c842", "#5edc78", "#5455ed",
    "#7d76fc", "#d4524d", "#42ebf5", "#fc5554",
    "#ff7978", "#d4c154", "#e6ce80", "#21b03b",
    "#c95bba", "#cccccc", "#ffffff"
  ],
  atariST: [
    "#000000", "#ffffff", "#777777", "#bbbbbb",
    "#880000", "#cc4444", "#ffaa55", "#ffff88",
    "#448844", "#66cc66", "#44aaaa", "#88ffff",
    "#224488", "#6688cc", "#8844aa", "#cc88ff"
  ],
  nes: [
    "#000000", "#7c7c7c", "#bcbcbc", "#ffffff",
    "#0000fc", "#0078f8", "#3cbcfc", "#6888fc",
    "#a80020", "#f83800", "#f87858", "#f8b878",
    "#005800", "#00b800", "#58d854", "#b8f818",
    "#503000", "#ac7c00", "#f8b800", "#f8d878"
  ],
  gameBoyPocket: [
    "#081820", "#346856", "#88c070", "#e0f8d0",
    "#102820", "#204838", "#589060", "#b0d890"
  ],
  macintoshClassic: [
    "#000000", "#1c1c1c", "#383838", "#555555",
    "#717171", "#8d8d8d", "#aaaaaa", "#c6c6c6",
    "#e2e2e2", "#ffffff"
  ],
  vaporwaveDos: [
    "#000000", "#120024", "#240046", "#3c096c",
    "#5a189a", "#7b2cbf", "#9d4edd", "#c77dff",
    "#ff5d8f", "#ff85a1", "#ffb3c1", "#ffd6ff",
    "#00f5d4", "#00bbf9", "#fee440", "#ffffff"
  ]
}