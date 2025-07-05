import {loadShaderSource} from "./webgl_runner.js";

export function makeShaderInit({fragURL, makeRunner}) {
    let fragSource = null;
    let runner = null;

    async function initHook() {
        if (runner == null) {
            runner = makeRunner();
        }
        if (fragSource == null) {
            const href =
                fragURL instanceof URL
                    ? fragURL.href
                    : fragURL.map((url) => url.href)
            fragSource = await loadShaderSource(href);
        }
    }

    return {
        get fragSource() { return fragSource; },
        get runner() { return runner; },
        initHook,
    };
}
