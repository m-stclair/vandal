import {loadShaderSource} from "./webgl_runner.js";

export function loadFragInit(fragURL) {
    let fragSource = null;

    async function initHook() {
        if (fragSource == null) {
            const href =
                fragURL instanceof URL
                    ? fragURL.href
                    : fragURL.map((url) => url.href)
            fragSource = await loadShaderSource(href);
        }
    }
    return {
        get fragSource() { return fragSource; }, initHook,
    };
}
