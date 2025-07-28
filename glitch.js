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
    uiState, setFreezeAnimationButtonFlag, lockRender, unlockRender
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


function stopCapture(recorder) {
    recorder.stop();
    document.getElementById('captureOverlay').style.display = 'none';
}

function startCapture() {
    const exportDuration = document.getElementById("exportDuration").value;
    const exportFPS = document.getElementById("exportFPS").value;

    const stream = renderer.gl.canvas.captureStream(exportFPS);
    const options = {
        mimeType: 'video/webm; codecs=vp9',
        videoBitsPerSecond: 16_000_000,
    }
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = vandalStamp('webm');
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
}


const isAnimationActive = () => getEffectStack().some(fx => isModulating(fx))

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
    setupPaneDrag();
    setupVideoExportModal();
    pruneForMobile(exportImage, loadState, effectRegistry, requestUIDraw,
                   requestRender, startCapture);
    setupWindow(resizeAndRedraw);
    // await loadState(getAppPresetView("Chromasplash"), effectRegistry, false);
    await drawPattern('wheel');
    resizeAndRedraw();
    uiLoop();
    renderLoop();
}

await appSetup();
