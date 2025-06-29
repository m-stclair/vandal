export default {
  sawtooth(x) {
    return 2 * (x / (2 * Math.PI) - Math.floor(x / (2 * Math.PI) + 0.5));
  },
  square(x) {
    return Math.sign(Math.sin(x));
  },
  tri(x) {
    return 2 * Math.abs(saw(x)) - 1;
  },
}