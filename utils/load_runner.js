import {loadShaderSource} from "./webgl_runner.js";

export function loadFragInit(fragURL) {
    let src = null;

    async function load() {
        if (src == null) {
            const href =
                fragURL instanceof URL
                    ? fragURL.href
                    : fragURL.map((url) => url.href)
            src = await loadShaderSource(href);
        }
    }
    return {
        get src() { return src; },
        load,
    };
}
