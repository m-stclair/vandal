import {
    addEffectSelect,
    buildEffectSelect,
    canvas,
    ctx, moveEffectInStack,
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
    clearConfigUI,
    flushEffectStack,
    addEffectToStack,
    getEffectStack,
    saveState,
    loadState,
    makeEffectInstance,
    setResizedOriginalImage,
    getResizedOriginalImage,
    forEachActiveEffect, getActiveEffects, getEffectById
} from "./state.js";
import {formatFloatWidth, gid, makeConfigHash} from "./utils/helpers.js";
import {buildUI} from "./ui_builder.js";
import {effectGroups, effectRegistry} from "./effects/index.js";
import {resolveAnim} from "./utils/animutils.js";

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
    const width = leftPane.clientWidth - 25;  // subtract some padding
    const height = window.innerHeight * 0.8;
    let scale = Math.min(
        width / originalImage.width, height / originalImage.height
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


function applyEffects(t = 0) {
    const resizedOriginalImage = getResizedOriginalImage();
    if (!resizedOriginalImage) return;
    let current = resizedOriginalImage;
    let needsRecompute = false;

    forEachActiveEffect((fx) => {
        const prior = current;
        if (!fx.apply) return;
        const cacheEntry = renderCacheGet(fx.id);
        const modulated = Object.values(fx.config).some(p =>
          typeof p === "object" && p.mod?.type !== "none"
        );
        const timeChanged = cacheEntry?.lastT !== t;
        const needsAnimationUpdate = modulated && timeChanged;
        const configChanged = (
            !cacheEntry
            || makeConfigHash(fx.config) !== makeConfigHash(cacheEntry.config)
        );
        const dependencyChanged = !cacheEntry || cacheEntry.dependsOn !== prior;
        if (configChanged || dependencyChanged || needsRecompute || needsAnimationUpdate) {
            const result = fx.apply(fx, prior, t);
            current = result;
            renderCacheSet(fx.id, {
                imageData: result,
                config: structuredClone(fx.config),
                disabled: fx.disabled,
                dependsOn: prior,
                lastT: t
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
    const filters = getActiveEffects()
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

function addEffectDropTarget(effectStack, stackContainer, i) {
    const dropZone = document.createElement("div");
    dropZone.className = "drop-zone";
    dropZone.dataset.index = i;
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drop-hover");
    });
    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drop-hover");
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const toIndex = parseInt(dropZone.dataset.index, 10);
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
            moveEffectInStack(effectStack, fromIndex, toIndex);
            clearRenderCache();
            updateApp();
        }
    });
    stackContainer.appendChild(dropZone);
}

function createLabelEditor(fx) {
    const label = document.createElement("span");
    label.className = "effectLabel";
    label.textContent = fx.label || fx.name;
    label.contentEditable = false;
    label.spellcheck = false;
    label.addEventListener("focus", () => {
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
    });

    const pencil = document.createElement("button");
    pencil.className = "editButton";
    pencil.innerHTML = "✎"; // or use an SVG/icon font
    pencil.title = "Rename effect";
    pencil.addEventListener("click", (e) => {
        e.stopPropagation();
        label.contentEditable = true;
        label.focus();
    });

    const labelWrapper = document.createElement("div");
    labelWrapper.className = "labelWrapper";
    labelWrapper.append(label, pencil);
    return labelWrapper;
}

function createControlGroup(fx, effectStack, i, configContainer) {
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
        updateApp();
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
        updateApp();
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
    delBtn.className = "efectButton";
    delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (fx.cleanupHook) {
            fx.cleanupHook(fx);
        }
        effectStack.splice(i, 1);
        clearRenderCache();
        configContainer.innerHTML = '';
        updateApp();
    });

    const controlGroup = document.createElement("div");
    controlGroup.className = "controlGroup";
    controlGroup.append(enableToggle, soloToggle, upBtn, downBtn, dupBtn, delBtn);
    return controlGroup;
}

function decorateRow(row, fx, i, effectStack) {
    row.setAttribute("draggable", true);
    row.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", i.toString());
    });
    const anySolo = effectStack.some(f => f.solo);
    if (anySolo) {
        row.classList.toggle("soloed", fx.solo);
        row.classList.toggle("unsoloed", !fx.solo);
    } else {
        row.classList.remove("soloed", "unsoloed");
    }
}

function renderEffectInStackUI(fx, i) {
    const configContainer = gid("configForm");
    const stackContainer = gid('effectStack');
    const effectStack = getEffectStack();
    const row = document.createElement('div');
    row.className = "effectRow";
    row.dataset.index = i;
    row.addEventListener("click", () => {
        buildUI(fx, configContainer, fx.config,
            debouncedApply, fx.uiLayout);
        renderStackUI();
    });
    const labelWrapper = createLabelEditor(fx);
    const controlGroup = createControlGroup(
        fx, effectStack, i, configContainer
    );
    const header = document.createElement("div");
    header.className = "effectHeader";
    header.append(labelWrapper, controlGroup);
    row.appendChild(header);
    decorateRow(row, fx, i, effectStack);
    stackContainer.appendChild(row);
}

function renderStackUI() {
    const stackContainer = gid('effectStack');
    stackContainer.innerHTML = '';
    const effectStack = getEffectStack();
    for (let i = 0; i <= effectStack.length; i++) {
        addEffectDropTarget(effectStack, stackContainer, i);
        if (i >= effectStack.length) return;
        renderEffectInStackUI(effectStack[i], i);
    }
}

function isAnimationActive() {
  return getEffectStack().some(fx =>
    fx.config && Object.values(fx.config).some(p =>
      typeof p === "object" && p.mod?.type !== "none"
    )
  );
}

let animating = false;
let startTime = null;

function tick(now) {
  if (!animating) return;
  const t = (now - startTime) / 1000;
  document.querySelectorAll(".modulated").forEach(input => {
      const key = input.dataset.key;
      const fxId = input.dataset.fxId;
      const fx = getEffectById(fxId);
      if (fx === null) throw new Error("Effect matching control is missing")
      const resolved = resolveAnim(fx.config[key], t);
      const label = input.parentElement.querySelector(".slider-value");
      label.textContent = formatFloatWidth(resolved);
    });
  applyEffects(t);
  if (isAnimationActive()) {
    requestAnimationFrame(tick);
  } else {
    animating = false;
  }
}


function updateApp() {
    renderStackUI();
    applyEffects();
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


async function addSelectedEffect() {
    const selected = addEffectSelect.value;
    if (!selected) return;
    const fx = makeEffectInstance(effectRegistry[selected]);
    await fx.ready;
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
