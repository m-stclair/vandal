import {
    canvas,
    defaultCtx, moveEffectInStack, placeholderOption,
    setupExportImage,
    setupPaneDrag, setupPresetUI,
    setupStaticButtons, setupVideoCapture, setupWindow
} from "./ui.js";

import {
    getOriginalImage,
    clearRenderCache,
    setOriginalImage,
    setRenderedImage,
    renderCacheSet,
    renderCacheGet,
    setFilters,
    forEachEffect,
    clearConfigUI,
    flushEffectStack,
    addEffectToStack,
    getEffectStack,
    saveState,
    loadState,
    makeEffectInstance,
    setResizedOriginalImage,
    getActiveEffects,
    getEffectById,
    clearNormedImage,
    getNormedImage,
    getNormLoadID,
    getSelectedEffectId, toggleEffectSelection, isSelectedEffect, renderer
} from "./state.js";
import {formatFloatWidth, gid, hashObject, imageDataHash} from "./utils/helpers.js";
import {buildUI} from "./ui_builder.js";
import {effectRegistry} from "./registry.js";
import {resolveAnim} from "./utils/animutils.js";
import {listEffectPresets, getEffectPresetView, saveEffectPreset} from "./utils/presets.js";
import {deNormalizeImageData, normalizeImageData} from "./utils/imageutils.js";
// DO NOT REMOVE THIS IMPORT!
import {EffectPicker} from "./components/effectpicker.js";

function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        setOriginalImage(img);
        resizeAndRedraw();
    }
    clearRenderCache();
    img.src = URL.createObjectURL(file);
}


function resizeAndRedraw() {
    const originalImage = getOriginalImage();
    if (!originalImage) return;
    const leftPane = document.getElementById('leftPane');
    const width = leftPane.clientWidth - 20;  // subtract some padding
    const height = window.innerHeight * 0.9;
    let scale = Math.min(
        width / originalImage.width, height / originalImage.height
    );

    const w = Math.floor(originalImage.width * scale);
    const h = Math.floor(originalImage.height * scale);

    canvas.width = w;
    canvas.height = h;

    defaultCtx.drawImage(originalImage, 0, 0, w, h);
    setRenderedImage(defaultCtx.getImageData(0, 0, w, h));
    setResizedOriginalImage(defaultCtx.getImageData(0, 0, w, h));
    clearNormedImage();
    renderImage();
}

let capturer = null, capturing = false;
let exportDuration = null, exportFPS = null, frameLimit = null;
let frameCounter = null;

function startCapture() {
    const format = document.getElementById("exportFormat").value;
    exportDuration = document.getElementById("exportDuration").value;
    exportFPS = document.getElementById("exportFPS").value;
    frameLimit = exportDuration * exportFPS;
    frameCounter = 0;
    capturer = new CCapture({
        format: format,
        framerate: exportFPS,
        verbose: true
    });
    capturer.start();
    capturing = true;
    document.getElementById('captureOverlay').style.display = 'flex';
    document.getElementById("overlayMessageP").innerText = "🎥 Recording…"
}

function stopCapture() {
    if (!capturing) return;
    capturing = false;
    capturer.stop();
    capturer.save();
    document.getElementById('captureOverlay').style.display = 'none';
}

function isModulating(fx) {
    return Object.values(fx.config).some(p =>
        p !== null
        && typeof p === "object"
        && p.mod?.type !== "none"
        && (!(p instanceof Array))
    )
}

let currentData = null; // null until GPU->CPU fallback occurs
let onGPU = true;


function applyEffects(t = 0, context = defaultCtx, normedImage = null) {
    if (!normedImage) {
        normedImage = getNormedImage();
    }
    if (normedImage === null) return;
    const {width, height} = normedImage;
    let {data} = normedImage;
    const anySolo = getEffectStack().some(fx => fx.solo);
    let hashChain = `top-${width}-${height}-${getNormLoadID()}`;
    let priorHash = hashChain;
    let animationUpdate = false;
    forEachEffect((fx) => {
        if (!fx.apply) return;
        if (fx.disabled || (anySolo && !fx.solo)) {
            hashChain += `${fx.name}-${fx.id}-disabled`;
            priorHash = hashChain;
            return;
        }
        const cacheEntry = renderCacheGet(fx.id);
        const timeChanged = cacheEntry?.lastT !== t;
        animationUpdate = animationUpdate ? animationUpdate : isModulating(fx) && timeChanged;
        hashChain += hashObject(fx.config) + fx.id;
        if (isModulating(fx)) hashChain += `-${t}`;
        const hashChanged = (
            !cacheEntry
            || hashChain !== cacheEntry.hashChain
        );
        if (hashChanged || animationUpdate) {
            // const enter = performance.now()
            // console.log(hashChain);
            data = fx.apply(fx, data, width, height, t, priorHash);
            // const exit = performance.now()
            // console.log(`rendered ${fx.name}-${fx.id}: ${exit-enter}ms`)
            renderCacheSet(fx.id, {
                data: data,
                config: structuredClone(fx.config),
                disabled: fx.disabled,
                hashChain: hashChain,
                lastT: t
            });
        } else {
            data = cacheEntry.data;
        }
        priorHash = hashChain;
    })
    setRenderedImage(deNormalizeImageData(data, width, height), context);
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

let rafPending = false;

function debouncedRender() {
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
        renderImage();
        rafPending = false;
    });
}

function createLabelEditor(fx) {
    const label = document.createElement("span");
    label.className = "effectLabel";
    label.textContent = fx.label || fx.name;
    label.contentEditable = false;
    label.spellcheck = false;
    label.addEventListener("click", (e) => {
        if (label.classList.contains("editing")) {
            e.stopPropagation();
        }
    });
    label.addEventListener("focus", (e) => {
        e.stopPropagation();
        label.classList.add("editing");
    });
    label.addEventListener("blur", () => {
        fx.label = label.textContent.trim();
        label.contentEditable = false;
        label.classList.remove("editing");
    });
    label.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            label.blur();
        } else if (e.key === "Escape") {
            e.preventDefault();
            label.textContent = fx.label;
            label.blur();
        }
    })

    const pencil = document.createElement("button");
    pencil.className = "editButton";
    pencil.innerHTML = "✎"; // or use an SVG/icon font
    pencil.title = "Rename effect";
    pencil.addEventListener("click", (e) => {
        e.stopPropagation();
        label.contentEditable = true;
        label.focus();
    });

    const presetDropdown = document.createElement('select');
    presetDropdown.appendChild(placeholderOption("Preset"));
    listEffectPresets(fx.name).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        presetDropdown.appendChild(opt);
    });

    presetDropdown.addEventListener('click', e => {
        e.stopPropagation()
    });


    presetDropdown.addEventListener('change', e => {
        e.stopPropagation()
        const selected = e.target.value;
        const preset = getEffectPresetView(fx.name, selected);
        if (preset) {
            Object.assign(fx.config, structuredClone(preset));
            renderImage();
        }
    });

    const savePresetBtn = document.createElement("button");
    savePresetBtn.innerHTML = "💾"
    savePresetBtn.className = "save-effect-preset-btn";
    savePresetBtn.addEventListener('click', e => {
        e.stopPropagation()
        saveEffectPreset(fx.name, label.textContent, structuredClone(fx.config));
        const newOpt = document.createElement('option');
        newOpt.value = label.textContent;
        newOpt.textContent = label.textContent;
        presetDropdown.appendChild(newOpt);
    });

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "labelWrapper";
    labelWrapper.append(label, pencil, presetDropdown, savePresetBtn);
    return labelWrapper;
}

function createControlGroup(fx, effectStack, i) {
    const enableToggle = document.createElement('input');
    enableToggle.type = 'checkbox';
    enableToggle.classList.add("enableToggle");
    enableToggle.classList.add("effectToggle");
    enableToggle.name = 'enable/disable'
    enableToggle.checked = !fx.disabled;
    enableToggle.title = 'Enable/Disable Effect';
    enableToggle.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    enableToggle.addEventListener('change', () => {
        fx.disabled = !enableToggle.checked;
        renderImage();
    });

    const soloToggle = document.createElement("input");
    soloToggle.type = "checkbox";
    soloToggle.classList.add("soloToggle");
    soloToggle.classList.add("effectToggle");
    soloToggle.checked = fx.solo ?? false;
    soloToggle.title = "Solo this effect";
    soloToggle.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    soloToggle.addEventListener("change", () => {
        const isNowSoloed = soloToggle.checked;

        for (const fx of effectStack) {
            fx.solo = false;
        }
        if (isNowSoloed) {
            fx.solo = true;
            fx.disabled = false;
        } else {
            fx.solo = false;
        }
        renderImage();
    });

    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "Move up";
    upBtn.disabled = i === 0;
    upBtn.className = "effectButton"
    upBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        moveEffectInStack(effectStack, i, i - 1);
        updateApp();
    });

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "Move down";
    downBtn.disabled = i === effectStack.length - 1;
    downBtn.className = "effectButton";
    downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        moveEffectInStack(effectStack, i, i + 1);
        updateApp();
    });

    const dupBtn = document.createElement("button");
    dupBtn.textContent = "⧉";
    dupBtn.title = "Duplicate effect";
    dupBtn.className = "effectButton";
    dupBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const newFx = makeEffectInstance(effectRegistry[fx.name]);
        await newFx.ready;
        newFx.config = structuredClone(fx.config);
        effectStack.splice(i + 1, 0, newFx);
        updateApp();
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.className = "effectButton";
    delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fx.cleanupHook) {
            fx.cleanupHook(fx);
        }
        effectStack.splice(i, 1);
        clearRenderCache();
        updateApp();
    });

    const controlGroup = document.createElement("div");
    controlGroup.className = "controlGroup";
    controlGroup.append(enableToggle, soloToggle, upBtn, downBtn, dupBtn, delBtn);
    return controlGroup;
}


function decorateForSolo(card, fx, effectStack) {
    const anySolo = effectStack.some(f => f.solo);
    if (anySolo) {
        card.classList.toggle("soloed", fx.solo);
        card.classList.toggle("unsoloed", !fx.solo);
    } else {
        card.classList.remove("soloed", "unsoloed");
    }
}

function renderEffectInStackUI(fx, i) {
    const stackContainer = gid('effectStack');
    // Main card container
    const card = document.createElement('div');
    card.className = 'effect-card';
    if (fx.id === getSelectedEffectId()) {
        card.classList.add('expanded');
    }
    // Header
    const header = document.createElement('div');
    header.className = 'effect-header';
    header.addEventListener('click', () => {
        toggleEffectSelection(fx);
        renderStackUI();
    });
    const effectStack = getEffectStack();
    const labelWrapper = createLabelEditor(fx);
    const controlGroup = createControlGroup(
        fx, effectStack, i,
        // configContainer
    );
    header.append(labelWrapper, controlGroup);
    card.appendChild(header);
    if (isSelectedEffect(fx)) {
        const configContainer = document.createElement('div');
        configContainer.className = 'effect-config';
        buildUI(fx, configContainer, fx.config,
            debouncedRender, fx.uiLayout);
        card.appendChild(configContainer);
    }
    // addDragListener(card, fx, i);
    decorateForSolo(card, fx, effectStack);
    stackContainer.appendChild(card);
}


function renderStackUI() {
    const stackContainer = gid('effectStack');
    stackContainer.innerHTML = '';
    const effectStack = getEffectStack();
    for (let i = 0; i <= effectStack.length; i++) {
        if (i >= effectStack.length) return;
        renderEffectInStackUI(effectStack[i], i);
    }
}

let freezeAnimationFlag = false;
let rendering = false;

function updateRenderMsg(msg) {
    // note: this doesn't really work. main render thread blocks too much
    requestAnimationFrame(() =>
        setTimeout(
            () => document.getElementById("overlayMessageP").innerText = `${msg}...`,
            10
        )
    )
}

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
        const t = animating ? (performance.now() - startTime) / 1000 : 0;
        updateRenderMsg("rendering effects")
        applyEffects(t, eCtx, normData);
        updateRenderMsg("rendering visual styles")
        updateVisualStyles(exportCanvas);
        updateRenderMsg("writing");
        exportCanvas.toBlob(onBlobResolved, 'image/png');
    }

    function cleanup() {
        rendering = false;  // just making sure
        document.getElementById("stopCaptureOverlay").style.display = "inherit"
        document.getElementById('captureOverlay').style.display = 'none';
        updateRenderMsg("");
        exportCanvas?.close?.() || exportCanvas?.remove?.();
        exportCanvas = null;
        eCtx = null;
        clearRenderCache();
        freezeAnimationFlag = false;
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
        freezeAnimationFlag = true;
        clearRenderCache();
        updateRenderMsg("setting up");
        document.getElementById("stopCaptureOverlay").style.display = "none"
        document.getElementById('captureOverlay').style.display = 'flex';
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

function tick(now) {
    if (!animating || freezeAnimationFlag) return;
    const t = (now - startTime) / 1000;
    document.querySelectorAll(".modulated").forEach(input => {
        const key = input.dataset.key;
        const fxId = input.dataset.fxId;
        const fx = getEffectById(fxId);
        if (fx === null) throw new Error("Effect matching control is missing")
        const resolved = resolveAnim(fx.config[key], t);
        const label = input.querySelector(".slider-value");
        label.textContent = formatFloatWidth(resolved);
    });
    applyEffects(t);
    if (capturing && capturer) {
        capturer.capture(document.getElementById('glitchCanvas'));
        frameCounter++;
        if (frameCounter >= frameLimit) stopCapture();
    }
    if (isAnimationActive()) {
        requestAnimationFrame(tick);
    } else {
        animating = false;
    }
}


function renderImage() {
    renderer.applyEffects(getEffectStack(), getNormedImage(), 0);
    updateVisualStyles();
    const animShouldBeRunning = isAnimationActive();
    if (animShouldBeRunning && !animating) {
        startTime = performance.now();
        animating = true;
        requestAnimationFrame(tick);
    } else if (!animShouldBeRunning && animating) {
        animating = false;
    }
}

function updateApp() {
    renderStackUI();
    renderImage();
}

function resetStack() {
    forEachEffect(
        (fx) => {
            if (fx.cleanupHook) {
                fx.cleanupHook(fx.id);
            }
        })
    flushEffectStack();
    clearRenderCache();
    clearConfigUI();
    updateApp();
}

async function addSelectedEffect(effectName) {
    if (!effectName) return;
    const fx = makeEffectInstance(effectRegistry[effectName]);
    await fx.ready;
    addEffectToStack(fx);
    toggleEffectSelection(fx);
    clearRenderCache()
    updateApp();
}

function drawBlackSquare(imgElement) {
    canvas.width = 1024;
    canvas.height = 1024;

    // Fill the canvas with black
    defaultCtx.fillStyle = 'black';
    defaultCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Set the image's src to the canvas data URL (black square image)
    imgElement.src = canvas.toDataURL();
    setOriginalImage(imgElement);
}

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
        updateApp,
        renderImage
    );
    setupPresetUI(saveState, loadState, updateApp, effectRegistry);
    setupExportImage(exportImage);
    setupVideoCapture(startCapture, stopCapture);
    setupPaneDrag();
    setupWindow(resizeAndRedraw);
    // Example usage with an HTMLImageElement
    const imgElement = document.createElement('img');
    drawBlackSquare(imgElement);
    resizeAndRedraw();


}

await appSetup();

