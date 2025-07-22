import {
    pruneForMobile,
    setupDragAndDrop,
    setupExportImage,
    setupPaneDrag,
    setupPresetUI,
    setupStaticButtons,
    setupVideoCapture,
    setupVideoExportModal,
    setupWindow
} from "./ui.js";

import {
    canvas,
    defaultCtx,
    addEffectToStack,
    clearRenderCache,
    Dirty,
    getActiveEffects,
    getEffectById,
    getEffectStack,
    getAnimationFrozen,
    getNormedImage,
    getOriginalImage,
    loadState,
    Lock,
    makeEffectInstance,
    renderer,
    requestRender,
    requestUIDraw,
    rerollNormLoadID,
    resetStack,
    resizeAndRedraw,
    saveState,
    setFilters,
    setFreezeAnimationFlag,
    setOriginalImage,
    setRenderedImage,
    toggleEffectSelection,
    uiState, setFreezeAnimationButtonFlag
} from "./state.js";
// import "./tools/debugPane.js";
import {formatFloatWidth, gid} from "./utils/helpers.js";
import {renderStackUI} from "./ui_builder.js";
import {effectRegistry} from "./registry.js";
import {resolveAnim} from "./utils/animutils.js";
import {deNormalizeImageData, normalizeImageData} from "./utils/imageutils.js";

// noinspection ES6UnusedImports
import {EffectPicker} from './components/effectpicker.js'
import {drawPattern} from "./test_patterns.js";
import {getAppPresetView} from "./utils/presets.js";

function handleUpload(e) {
    let file;
    if (!(e instanceof File)) {
        file = e.target.files[0];
    } else {
        file = e;
    }
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        setOriginalImage(img);
        resizeAndRedraw();
    }
    img.src = URL.createObjectURL(file);
}


function stopCapture(recorder) {
    recorder.stop();
    document.getElementById('captureOverlay').style.display = 'none';
}

function startCapture() {
    const exportDuration = document.getElementById("exportDuration").value;
    const exportFPS = document.getElementById("exportFPS").value;

    const stream = renderer.gl.canvas.captureStream(exportFPS);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks = [];

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "capture.webm";
        a.click();
    };
    document.getElementById('captureOverlay').style.display = 'flex';
    recorder.start();

    setTimeout(() => stopCapture(recorder), exportDuration * 1000);
}


export function isModulating(fx) {
    return Object.values(fx.config).some(p =>
        p !== null
        && typeof p === "object"
        && p.mod?.type !== "none"
        && (!(p instanceof Array))
    )
}

function maybeCallStyleHook(fx) {
    if (!fx.styleHook || fx.disabled) {
        return false;
    }
    return fx.styleHook(fx);
}

function updateVisualStyles(cvs = canvas) {
    const filters = getActiveEffects()
        .map(fx => maybeCallStyleHook(fx))
        .filter(Boolean)
        .join(' ');
    setFilters(filters || 'none', cvs);
}


let rendering = false;

async function exportImage(resolution) {
    let exportCanvas = document.createElement("canvas");

    function getImg() {
        if (resolution === "full") {
            const img = getOriginalImage();
            if (!img) return;
            exportCanvas.width = img.width;
            exportCanvas.height = img.height;
            const eCtx = exportCanvas.getContext('2d');
            eCtx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = eCtx.getImageData(0, 0, img.width, img.height)
            const normData = normalizeImageData(imageData);
            return [normData, eCtx];
        } else {
            const imageData = getNormedImage();
            exportCanvas.width = imageData.width;
            exportCanvas.height = imageData.height;
            const eCtx = exportCanvas.getContext('2d')
            return [imageData, eCtx];
        }
    }

    let [normData, eCtx] = getImg();

    function executeRender() {
        renderer.reset();
        firePipeline(eCtx);
        updateVisualStyles(exportCanvas);
        exportCanvas.toBlob(onBlobResolved, 'image/png');
    }

    function cleanup() {
        rendering = false;  // just making sure
        // document.getElementById("stopCaptureOverlay").style.display = "inherit"
        // document.getElementById('captureOverlay').style.display = 'none';
        // updateRenderMsg("");
        exportCanvas?.close?.() || exportCanvas?.remove?.();
        exportCanvas = null;
        eCtx = null;
        renderer.reset();
        setFreezeAnimationFlag(false);
        rerollNormLoadID();  // to trigger framebuffer invalidation
    }

    function onBlobResolved(blob) {
        const link = document.createElement('a');
        const date = new Date();
        const timestamp = date.toISOString().replace(/[^0-9]/g, '');
        link.download = `glitch_${timestamp}.png`;
        link.href = URL.createObjectURL(blob);
        try {
            link.click();
        } finally {
            rendering = false;
            cleanup();
            URL.revokeObjectURL(link.href);
        }
    }

    try {
        setFreezeAnimationFlag(true);
        clearRenderCache();
        // updateRenderMsg("setting up");
        // document.getElementById("stopCaptureOverlay").style.display = "none"
        // document.getElementById('captureOverlay').style.display = 'flex';
        requestAnimationFrame(() => setTimeout(executeRender, 10));
    } catch (e) {
        rendering = false;
        console.error(e)
        cleanup();
        alert("Rendering failed")
    }
}

const isAnimationActive = () => getEffectStack().some(fx => isModulating(fx))

let animating = false;
let startTime = null;
let timePhase = 0;

function tick() {
    if (!animating) return;
    if (getAnimationFrozen()) {
        requestAnimationFrame(tick);
        return;
    }
    document.querySelectorAll(".modulated").forEach(input => {
        const key = input.dataset.key;
        const fxId = input.dataset.fxId;
        const fx = getEffectById(fxId);
        if (fx === null) {
            // this generally represents a harmless race condition -- the effect was
            // deleted after resolving querySelectorAll() and can no longer be
            // animated. Treat it as a very soft fault.
            return;
        }
        const resolved = resolveAnim(fx.config[key], timePhase);
        const label = input.querySelector(".slider-value");
        label.textContent = formatFloatWidth(resolved);
    });
    requestRender();
    if (isAnimationActive()) {
        requestAnimationFrame(tick);
    } else {
        animating = false;
    }
}

function firePipeline(ctx = defaultCtx, t = null) {
    let time;
    if (animating && t === null) {
        timePhase += 30 / 1000;
        time = timePhase;
    } else {
        time = t;
    }
    const finalTexture = renderer.applyEffects(time);
    renderer.writeToCanvas(finalTexture);

}


// setRenderedImage(deNormalizeImageData(applied, width, height), ctx)
// updateVisualStyles();

function renderImage() {
    if (!renderer.inputTexture) return;
    firePipeline();
    const animShouldBeRunning = isAnimationActive();
    if (animShouldBeRunning && !animating) {
        startTime = performance.now();
        animating = true;
        requestAnimationFrame(tick);
    } else if (!animShouldBeRunning && animating) {
        animating = false;
    }
}

async function addSelectedEffect(effectName) {
    if (!effectName) return;
    const fx = makeEffectInstance(effectRegistry[effectName]);
    await fx.ready;
    addEffectToStack(fx);
    toggleEffectSelection(fx);
    clearRenderCache()
    requestUIDraw();
    requestRender();
}


function watchRender() {
    if (Lock.image || !Dirty.image) return;
    Lock.image = true;
    Dirty.image = false;
    try {
        renderImage()
    } finally {
        Lock.image = false;
    }
}

function watchUI() {
    if (Lock.ui || !Dirty.ui) return;
    Lock.ui = true;
    Dirty.ui = false;
    try {
        renderStackUI(getEffectStack(), uiState, gid('effectStack'));
    } finally {
        Lock.ui = false;
    }
}

function rafScheduler(func, name, registry) {
    return () => {
        func();
        registry[name] = requestAnimationFrame(rafScheduler(func, name, registry));
    }
}


const loopIDs = {};
const renderLoop = rafScheduler(watchRender, "render", loopIDs);
const uiLoop = rafScheduler(watchUI, "ui", loopIDs);


async function appSetup() {
    const stackHeader = document.getElementById("effectStackHeader")
    const picker = document.createElement("effect-picker")
    stackHeader.appendChild(picker);
    await picker.ready;

    function toggleExpand() {
        if (picker.inSearchMode) {
            stackHeader.style.flexShrink = '0';
            stackHeader.style.flexGrow = '2';
        } else {
            stackHeader.style.flexShrink = '1';
            stackHeader.style.flexGrow = '1';
        }
    }

    picker.setEffectSelectCallback(
        async (effectName) => {
            await addSelectedEffect(effectName);
            toggleExpand();
        }
    );
    ["input", "keydown"].forEach(
        (eType) => stackHeader.addEventListener(
            eType, (e) => {
                if (e.type === "input" || e.key === "Escape" || e.key === "Enter") {
                    toggleExpand();
                }
            }
        )
    )
    const toggleBar = document.getElementById('toggle-stack-bar');
    const effectStack = document.getElementById('effectStack');
    toggleBar.addEventListener('click', function () {
        effectStack.classList.toggle('collapsed');
        toggleBar.classList.toggle('collapsed');
    });
    await setupStaticButtons(
        handleUpload,
        addSelectedEffect,
        saveState,
        loadState,
        effectRegistry,
        resetStack,
        requestRender,
        requestUIDraw,
        renderImage,
        setFreezeAnimationButtonFlag
    );
    setupPresetUI(
        saveState,
        loadState,
        resetStack,
        requestRender,
        requestUIDraw,
        effectRegistry
    );
    setupDragAndDrop(handleUpload);
    setupExportImage(exportImage);
    setupVideoCapture(startCapture, stopCapture);
    setupPaneDrag();
    setupVideoExportModal();
    pruneForMobile(exportImage, loadState, effectRegistry, requestUIDraw, requestRender);
    setupWindow(resizeAndRedraw);
    await loadState(getAppPresetView("Chromasplash"), effectRegistry, false);
    await drawPattern('spiral');
    resizeAndRedraw();
    uiLoop();
    renderLoop();
}

await appSetup();
