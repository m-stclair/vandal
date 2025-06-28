import {
    addEffectSelect,
    buildEffectSelect,
    canvas,
    ctx,
    setupEffectStackDragAndDrop,
    setupPaneDrag,
    setupStaticButtons, setupWindow
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
    filterEffectStack,
    clearConfigUI,
    flushEffectStack,
    addEffectToStack,
    getEffectStack, saveState, loadState, makeEffectInstance, setResizedOriginalImage, getResizedOriginalImage
} from "./state.js";
import {gid, makeConfigHash} from "./utils.js";
import {buildUI} from "./ui_builder.js";
import {effectGroups, effectRegistry} from "./effects/index.js";

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
    const maxWidth = leftPane.clientWidth - 20;  // subtract some padding
    const maxHeight = window.innerHeight * 0.8;
    let scale = Math.min(
        maxWidth / originalImage.width, maxHeight / originalImage.height, 1
    );

    const w = Math.floor(originalImage.width * scale);
    const h = Math.floor(originalImage.height * scale);

    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(originalImage, 0, 0, w, h);
    setRenderedImage(ctx.getImageData(0, 0, w, h));
    setResizedOriginalImage(ctx.getImageData(0, 0, w, h));
    updateApp();
}

function applyEffects() {
    const resizedOriginalImage = getResizedOriginalImage();
    if (!resizedOriginalImage) return;
    let current = resizedOriginalImage;
    let needsRecompute = false;

    forEachEffect((fx) => {
        if (fx.disabled || !fx.apply) return;
        const cacheEntry = renderCacheGet(fx.id);
        const prior = current;
        const configChanged = (
            !cacheEntry
            || makeConfigHash(fx.config) !== makeConfigHash(cacheEntry.config)
        );
        const dependencyChanged = !cacheEntry || cacheEntry.dependsOn !== prior;
        if (configChanged || dependencyChanged || needsRecompute) {
            const result = fx.apply(fx, prior);
            current = result;
            renderCacheSet(fx.id, {
                imageData: result,
                config: structuredClone(fx.config),
                disabled: fx.disabled,
                dependsOn: prior,
            });
            needsRecompute = true;
        } else {
            current = cacheEntry.imageData;
        }
    })
    setRenderedImage(current);
}

function maybeCallStyleHook(fx) {
    if (!fx.styleHook || fx.disabled) {
        return false;
    }
    return fx.styleHook(fx);
}

function updateVisualStyles() {
    const filters = getEffectStack()
        .map(fx => maybeCallStyleHook(fx))
        .filter(Boolean)
        .join(' ');
    setFilters(filters || 'none');
}

let rafPending = false;

function debouncedApply() {
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(() => {
        updateApp();
        rafPending = false;
    });
}

function renderEffectInStackUI(fx, i) {
    const configContainer = gid("configForm");
    const stackContainer = gid('effectStack');
    const div = document.createElement('div');
    div.textContent = fx.name;
    div.classList.add('effectRow');

    div.onclick = () => {
        // Build the config UI fresh
        buildUI(fx, configContainer, fx.config, debouncedApply, fx.uiLayout);
        renderStackUI(); // trigger visual updates
    };
    const delBtn = document.createElement('button');
    delBtn.textContent = '×';
    delBtn.onclick = (e) => {
        e.stopPropagation();
        if (fx.cleanupHook) {
            fx.cleanupHook(fx);
        }
        filterEffectStack(e => e.id !== fx.id);
        clearRenderCache();
        configContainer.innerHTML = '';
        updateApp();
    };
    div.appendChild(delBtn);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.name = 'enable/disable'
    toggle.checked = !fx.disabled;
    toggle.title = 'Enable/Disable Effect';
    toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // block the parent div.onclick
    });
    toggle.addEventListener('change', () => {
        fx.disabled = !toggle.checked;
        updateApp();
    });
    div.appendChild(toggle);

    div.dataset.index = i;
    div.draggable = true;
    stackContainer.appendChild(div);
}

function renderStackUI() {
    const stackContainer = gid('effectStack');
    stackContainer.innerHTML = '';
    forEachEffect((fx, i) => renderEffectInStackUI(fx, i));
}

function updateApp() {
    renderStackUI();
    applyEffects();
    updateVisualStyles();
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


function addSelectedEffect() {
    const selected = addEffectSelect.value;
    const fx = makeEffectInstance(effectRegistry[selected]);
    addEffectToStack(fx);
    addEffectSelect.value = '';
    clearRenderCache()
    updateApp();
}

function appSetup() {
    setupStaticButtons(
        handleUpload,
        addSelectedEffect,
        saveState,
        loadState,
        effectRegistry,
        resetStack,
        updateApp
    );
    buildEffectSelect(effectGroups);
    setupEffectStackDragAndDrop(
        getEffectStack(), clearRenderCache, updateApp
    )
    setupPaneDrag();
    setupWindow(resizeAndRedraw);
}

appSetup();
