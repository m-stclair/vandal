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
    loadState,
    Lock,
    makeEffectInstance,
    renderer,
    requestRender,
    requestUIDraw,
    resetStack,
    resizeAndRedraw,
    saveState,
    setFilters,
    setOriginalImage,
    toggleEffectSelection,
    uiState, setFreezeAnimationButtonFlag, lockRender, unlockRender, flushEffectStack
} from "./state.js";
// import "./tools/debugPane.js";
import {downloadBlob, formatFloatWidth, gid, vandalStamp} from "./utils/helpers.js";
import {renderStackUI} from "./ui_builder.js";
import {effectRegistry} from "./registry.js";
import {resolveAnim} from "./utils/animutils.js";

// noinspection ES6UnusedImports
import {EffectPicker} from './components/effectpicker.js'
import {drawPattern} from "./test_patterns.js";
import {getAppPresetView} from "./utils/presets.js";


let animating = false;
let startTime = null;
let timePhase = 0;


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


let activeCapture = null;

function getVideoMimeType() {
    if (!window.MediaRecorder) return null;

    const candidates = [
        "video/webm; codecs=vp9",
        "video/webm; codecs=vp8",
        "video/webm"
    ];

    return candidates.find(type => MediaRecorder.isTypeSupported(type)) ?? "";
}

function parseCaptureNumber(id, fallback, min, max) {
    const el = document.getElementById(id);
    const value = Number(el?.value);

    if (!Number.isFinite(value)) return fallback;

    return Math.min(max, Math.max(min, value));
}

function stopCapture() {
    if (!activeCapture) return;

    const { recorder, timeoutId } = activeCapture;

    if (timeoutId) {
        clearTimeout(timeoutId);
        activeCapture.timeoutId = null;
    }

    if (recorder.state !== "inactive") {
        recorder.stop();
    }
}

function cleanupCaptureUI() {
    document.getElementById("captureOverlay").style.display = "none";
}

function startCapture() {
    if (activeCapture) {
        console.warn("Capture already running.");
        return;
    }

    const canvas = renderer.gl.canvas;

    if (!canvas.captureStream) {
        alert("Video capture is not supported in this browser.");
        return;
    }

    if (!window.MediaRecorder) {
        alert("MediaRecorder is not supported in this browser.");
        return;
    }

    const exportDuration = parseCaptureNumber("exportDuration", 4, 1, 30);
    const exportFPS = parseCaptureNumber("exportFPS", 30, 1, 60);

    const mimeType = getVideoMimeType();
    if (mimeType === null) {
        alert("Video recording is not supported in this browser.");
        return;
    }

    const stream = canvas.captureStream(exportFPS);

    const options = {
        videoBitsPerSecond: 16_000_000
    };

    if (mimeType) {
        options.mimeType = mimeType;
    }

    let recorder;

    try {
        recorder = new MediaRecorder(stream, options);
    } catch (err) {
        stream.getTracks().forEach(track => track.stop());
        console.error("Failed to create MediaRecorder:", err);
        alert("Could not start video recording with this browser's supported codecs.");
        return;
    }

    const chunks = [];

    activeCapture = {
        recorder,
        stream,
        chunks,
        timeoutId: null
    };

    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error ?? event);
        stopCapture();
    };

    recorder.onstop = () => {
        const capture = activeCapture;

        if (capture?.timeoutId) {
            clearTimeout(capture.timeoutId);
        }

        stream.getTracks().forEach(track => track.stop());
        cleanupCaptureUI();

        activeCapture = null;

        if (!chunks.length) {
            console.warn("Capture produced no video chunks.");
            return;
        }

        const blob = new Blob(chunks, {
            type: recorder.mimeType || mimeType || "video/webm"
        });

        downloadBlob(blob, vandalStamp("webm"));
    };

    document.getElementById("captureOverlay").style.display = "flex";

    // Make sure at least the current frame is fresh when recording begins.
    requestRender();

    recorder.start();

    activeCapture.timeoutId = setTimeout(() => {
        stopCapture();
    }, exportDuration * 1000);
}


export function isModulating(fx) {
    return Object.values(fx.config).some(p =>
        p !== null
        && typeof p === "object"
        && p.mod?.type !== "none"
        && (!(p instanceof Array))
    )
}

export function isAnimatingEffect(fx) {
    return isModulating(fx) || !!fx.meta?.stateful;
}

async function exportImage() {
    Lock.image = true;
    const [w, h] = [renderer.cachedImage.width, renderer.cachedImage.height]
    const pixels = await renderer.applyFullRes(animating ? timePhase : 0);
    Lock.image = false;
    const imgArr = new Uint8ClampedArray(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
        imgArr[i] = Math.round(pixels[i] * 255);
    }
    const imgData = new ImageData(imgArr, w, h);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").putImageData(imgData, 0, 0);
    canvas.toBlob(blob => downloadBlob(blob, vandalStamp('png')), "image/png");
    requestRender();
}


const isAnimationActive = () => getEffectStack().some(fx => isAnimatingEffect(fx))

let frameIx = 0;

function tick() {
    if (!animating) return;
    if (getAnimationFrozen()) {
        requestAnimationFrame(tick);
        return;
    }
    // i.e., update displayed parameter values every sixth frame
    frameIx = (frameIx + 1) % 6;
    if (frameIx === 0) {
        document.querySelectorAll(".slider-value.animating").forEach(input => {
            const key = input.dataset.key;
            const fxId = input.dataset.fxId;
            const fx = getEffectById(fxId);
            if (fx === null) {
                // this generally represents a harmless race condition -- we
                // resolved querySelectorAll() during effect teardown but before
                // the associated DOM nodes were removed.
                return;
            }
            const resolved = resolveAnim(fx.config[key], timePhase);
            input.value = formatFloatWidth(resolved);
        });
    }

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
    if (!renderer.cachedImage) return;
    const finalTexture = renderer.applyEffects(time);
    renderer.writeToCanvas(finalTexture);
}


function renderImage() {
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
    const workerURL = new URL(`./cache-worker.js`, import.meta.url);
    if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register(workerURL);
    }
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
    setupStaticButtons(
        handleUpload,
        saveState,
        resetStack,
        requestRender,
        requestUIDraw,
        setFreezeAnimationButtonFlag
    );
    setupPresetUI(
        saveState,
        loadState,
        resetStack,
        requestRender,
        requestUIDraw,
        effectRegistry,
        lockRender,
        unlockRender
    );
    setupDragAndDrop(handleUpload);
    setupExportImage(exportImage);
    setupVideoCapture(startCapture, stopCapture);
    setupPaneDrag(resizeAndRedraw);
    setupVideoExportModal();
    pruneForMobile(exportImage, loadState, resetStack, effectRegistry, requestUIDraw,
                   requestRender, startCapture);
    setupWindow(resizeAndRedraw);
    await drawPattern('spiral');
    await loadState(getAppPresetView("Chromasplash"), effectRegistry, false);
    renderLoop();
    uiLoop();
}

await appSetup();