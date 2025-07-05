function injectEdgeFilter(config, id) {
    const t = config.threshold / 255;
    const s = 50;
    const i = -s * t;

    const existing = document.getElementById(id);
    if (existing) {
        // Update radius if already present
        existing.querySelectorAll("feMorphology").forEach(f => {
            f.setAttribute("radius", config.radius);
        });
        existing.querySelectorAll("feComponentTransfer feFuncR, feComponentTransfer feFuncG, feComponentTransfer feFuncB")
            .forEach(func => {
                func.setAttribute("slope", s);
                func.setAttribute("intercept", i);
            });
        return;
    }


    const svgNS = "http://www.w3.org/2000/svg";
    const filter = document.createElementNS(svgNS, "filter");
    filter.setAttribute("id", id);
    filter.setAttribute("x", "0%");
    filter.setAttribute("y", "0%");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");
    filter.setAttribute("in", "SourceGraphic");

    filter.innerHTML = `
    <feComponentTransfer in="SourceGraphic" result="original">
      <feFuncR type="identity"/>
      <feFuncG type="identity"/>
      <feFuncB type="identity"/>
      <feFuncA type="identity"/>
    </feComponentTransfer>
      <feColorMatrix type="matrix" in="original" result="gray"
        values="0.2126 0.7152 0.0722 0 0
                0.2126 0.7152 0.0722 0 0
                0.2126 0.7152 0.0722 0 0
                0      0      0      1 0" />
    <feComponentTransfer in="gray" result="binary">
      <feFuncR type="linear" slope="${s}" intercept="${i}"/>
      <feFuncG type="linear" slope="${s}" intercept="${i}"/>
      <feFuncB type="linear" slope="${s}" intercept="${i}"/>
    </feComponentTransfer>      
    <feMorphology in="binary" operator="dilate" radius="${config.radius}" result="dilated"/>
      <feMorphology in="binary" operator="erode" radius="${config.radius}" result="eroded"/>
      <feComposite in="dilated" in2="eroded" operator="arithmetic"
             k1="1" k2="-1" k3="0" k4="0.5" result="edge"/>
    <feColorMatrix in="edge" result="edgeAlpha"
      type="matrix"
      values="0 0 0 0 0
              0 0 0 0 0
              0 0 0 0 0
              1 1 1 0 0" />    
    <feComposite in="original" in2="edgeAlpha" operator="in" result="masked"/>    `;

    const svgRoot = document.querySelector("svg#filter-defs");
    const defs = svgRoot.querySelector("defs");
    defs.appendChild(filter);
}

/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "EdgeTrace",

    defaultConfig: {
        radius: 2,
        threshold: 128
    },

    styleHook(instance) {
        const filterId = `edgeTraceFilter-${instance.id}`
        injectEdgeFilter(instance.config, filterId);
        const el = document.getElementById(filterId)
        el.dataset.edgeTraceFilter = filterId;
        el.style.filter = `url(#${filterId})`;
        return `url(#${filterId})`;
    },

    cleanupHook(instance) {
        const filterId = `edgeTraceFilter-${instance.id}`
        const filter = document.getElementById(filterId);
        if (filter) filter.remove();
    },

    uiLayout: [
        {type: "range", key: "radius", label: "Edge Radius", min: 1, max: 5, step: 1},
        {type: "range", key: "threshold", label: "Threshold", min: 0, max: 1, step: 0.005}
    ]
};

export const effectMeta = {
  group: "Edge",
  tags: ["edges", "masking", "outline", "threshold"],
  description:
    "A binary edge detector using luminance gradients and thresholding. Outputs " +
      "sharp monochrome outlines ideal for use as masks or overlays. The edge " +
      "direction, contrast, and blur radius can be modulated to fine-tune the " +
      "trace. Works well as a pre-pass or compositing stage.",
  backend: "cpu",
  animated: true,  // due to modSlider
  visual: false,
  realtimeSafe: true,
}