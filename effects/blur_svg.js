/** @typedef {import('../glitchtypes.ts').EffectModule} EffectModule */
/** @type {EffectModule} */
export default {
    name: "Blur (SVG)",
    defaultConfig: {
        sigma: 4
    },

    uiLayout: [
      { type: "range", key: "sigma", label: "Sigma", min: 1, max: 15, step: 1 }
    ],

    styleHook(config, uuid) {
        const dom_id = `blurFilter-${uuid}`;
        let filter = document.getElementById(dom_id);
        if (!filter) {
            const svg = document.querySelector("svg");
            filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            filter.setAttribute("id", dom_id);
            svg.appendChild(filter);

            const blur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
            blur.setAttribute("in", "SourceGraphic");
            filter.appendChild(blur);
        }
        const SVG_NS = "http://www.w3.org/2000/svg";
        const blur = filter.getElementsByTagNameNS(SVG_NS, "feGaussianBlur")[0];
        blur.setAttribute("stdDeviation", config.sigma);
        return `url(#${dom_id})`;
    },

    cleanupHook(uuid) {
        const dom_id = `blurFilter-${uuid}`;
        const filter = document.getElementById(dom_id);
        if (filter) filter.remove();
    }
}

