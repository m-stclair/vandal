import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.mjs";

export let pdrInitializedFlag = false;

let pyodidePromise = null;

export function getPyodide() {
    if (!pyodidePromise) {
        pyodidePromise = loadPyodide();
    }
    return pyodidePromise;
}

export async function installPDR() {
    if (pdrInitializedFlag) return;
    const pyodide = await getPyodide();
    console.log("preparing micropip...");
    await pyodide.loadPackage("micropip");
    // micropip priints its own logs
    await pyodide.runPythonAsync(`
        import micropip
        await micropip.install("pdr[pillow,fits]") 
    `);
    console.log("prepping local python...");
    await pyodide.runPythonAsync(await (await fetch("pdrview.py")).text());
}

export async function initPDR() {
    if (pdrInitializedFlag) return;
    console.log("fetching pyodide...");
    await getPyodide();
    await installPDR();
    pdrInitializedFlag = true;
    console.log("ready!");
}

export async function getFirstImage(path) {
    const pyodide = await getPyodide();
    const result = await pyodide.runPythonAsync(`get_first_image("${path}")`);
    const [arrProxy, shape] = result.toJs({ dict_converter: Object });
    const flat = arrProxy;
    const gray = flat instanceof Uint8Array ? flat : Uint8Array.from(flat);
    const [ni, nj] = shape;
    // NOTE: orientation flip is intentional due to different index order convention
    return {pixels: padGrayscaleToRGBA(gray, nj, ni), width: nj, height: ni};
}

function padGrayscaleToRGBA(gray, width, height) {
    const len = width * height;
    if (gray.length !== len) {
        throw new Error(`Expected ${len} pixels, got ${gray.length}`);
    }

    const rgba = new Uint8Array(len * 4);
    for (let i = 0; i < len; i++) {
        const v = gray[i];
        const j = i * 4;
        rgba[j + 0] = v; // R
        rgba[j + 1] = v; // G
        rgba[j + 2] = v; // B
        rgba[j + 3] = 255; // A
    }
    return rgba;
}

//     await pyodide.runPythonAsync(`load_product("${file.name}")`);
//     const dataJSON = await pycall(`describe_data("${file.name}")`);
//     logDebug(`Loaded ${dataJSON} from Python`);
//     const data = JSON.parse(dataJSON);
//     logDebug(`Converted to ${data}`);
//     const container = document.getElementById("data-explorer");
//     container.innerHTML = "";
//     createDataExplorer(container, data);
//     // await pyodide.runPythonAsync(`arr = get_array_for_js("${file.name}", "${Object.keys(data.objects)[0]}")`);
//     // const arrJs = pyodide.globals.get("arr").toJs();
//     // console.log(arrJs)
//     // renderGrayscaleToCanvas(arrJs);
//     initWebGL();
//     const obj = Object.keys(data.objects)[0];
//     const result = await pycall(`get_array_object_normalized("${file.name}", "${obj}")`);
//     const [arrProxy, shape] = result.toJs({ dict_converter: Object });
//     const flat = arrProxy;
//     const gray = flat instanceof Uint8Array ? flat : Uint8Array.from(flat);