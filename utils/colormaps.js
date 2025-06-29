import { lerpColor, hex2Rgb, hsl2Rgb } from './colorutils.js';

/** Map name → colormap function */
export const colormaps = {
  moonbow: fromList([
      "#3E055C", "#462BBC", "#2866C0", "#28A72B", "#CFB675",
      "#F9DCFC",
  ]),
  bowmoon: fromList([
      "#351D21", "#6F3812", "#766C07", "#10A737", "#96BEF6",
  ]),
  vaportrail: fromList([
      "#000000", "#210740", "#590080", "#BF5AAD", "#FF96B6",
  ]),
  neon: fromList([
      "#FF00D4", "#941212", "#000000", "#3B73F5", "#9CFCFF",
  ]),
  sunset: fromList([
    "#000000", "#001F2E", "#2B3BB8", "#CD6BF5", "#FFAD96",
  ]),
  orange_teal: fromList([
    "#FF9729", "#D07A21", "#A25E18", "#74410F", "#461506",
    "#220A03", "#000000", "#03221F", "#07443F", "#0C665F",
    "#10987F", "#14BA9F", "#18DCC0", "#1CFEE0", "#28FFF0"
  ]),
  viridis: fromList([
    "#440154", "#482777", "#3E4989", "#31688E", "#26838F",
    "#1F9E89", "#35B779", "#6DCD59", "#B4DE2C", "#FDE725"
  ]),
  grayscale: (t) => [t * 255, t * 255, t * 255],
  rainbow: (t) => {
    const h = (1 - t) * 0.7;
    return hsl2Rgb(h, 1, 0.5);
  },
  inferno: fromList([
    "#000004", "#1B0C41", "#4A0C6B", "#781C6D", "#A52C60",
    "#CF4446", "#ED6925", "#FB9A06", "#F7D13D", "#FCFFA4"
  ]),
  aqua_pink: fromList([
    "#00FFFF", "#3FBFBF", "#7F7F7F", "#BF3FBF", "#FF00FF"
  ])

};

/** Build a colormap from a list of CSS color strings */
export function fromList(colorList) {
  const stops = colorList.map(hex2Rgb);
  return function(t) {
    const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
    const i = Math.floor(x);
    const frac = x - i;
    const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
    return lerpColor(a, b, frac);
  }
}