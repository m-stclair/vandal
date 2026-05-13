import {gid} from "./utils/helpers.js";
import {
    addUserPreset,
    listAppPresets,
    getAppPresetView,
    deleteUserPreset,
    updateAppPresets,
} from "./utils/presets.js";
import {populateTestSelect} from "./test_patterns.js";
import {randomizeEffectStack} from "./utils/randomizer.js";


// pane dragging logic
const dragBar = document.getElementById("dragBar");
const leftPane = document.getElementById("leftPane");
const rightPane = document.getElementById("rightPane");
const layout = document.getElementById("mainLayout");

const DEFAULT_RIGHT_PANE_WIDTH = 300;
let preferredRightPaneWidth = null;

function readPx(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function paneDragIsActive() {
    return Boolean(
        layout?.isConnected &&
        leftPane?.isConnected &&
        rightPane?.isConnected &&
        dragBar?.isConnected &&
        getComputedStyle(rightPane).display !== "none"
    );
}

function getVisibleLayoutWidth(layoutRect) {
    const viewportWidth = window.visualViewport?.width ||
        document.documentElement.clientWidth ||
        window.innerWidth ||
        layoutRect.width;
    const visibleRight = Math.min(layoutRect.right, viewportWidth);
    return Math.max(0, visibleRight - layoutRect.left);
}

function getPaneMetrics() {
    const layoutRect = layout.getBoundingClientRect();
    const dragWidth = dragBar.getBoundingClientRect().width || 5;
    const leftStyle = getComputedStyle(leftPane);
    const rightStyle = getComputedStyle(rightPane);
    const minLeft = readPx(leftStyle.minWidth, 100);
    const configuredMinRight = readPx(rightStyle.minWidth, DEFAULT_RIGHT_PANE_WIDTH);
    const availableWidth = getVisibleLayoutWidth(layoutRect);

    // The right pane should keep its usual minimum when there is room. When
    // the browser is made narrower than the normal minimums, the right pane
    // must be allowed to shrink instead of being pushed behind overflow:hidden.
    const maxRight = Math.max(0, availableWidth - dragWidth - minLeft);
    const minRight = Math.min(configuredMinRight, maxRight);

    return {layoutRect, dragWidth, minRight, maxRight};
}

function applyRightPaneWidth(rawWidth) {
    if (!paneDragIsActive()) return null;

    const {minRight, maxRight} = getPaneMetrics();
    const clampedWidth = Math.round(
        Math.min(Math.max(rawWidth, minRight), maxRight)
    );

    layout.style.setProperty("--right-pane-width", `${clampedWidth}px`);
    return clampedWidth;
}

function reclampRightPane() {
    if (!paneDragIsActive() || preferredRightPaneWidth === null) return;
    applyRightPaneWidth(preferredRightPaneWidth);
}

function makeRafScheduler(fn) {
    let queued = false;
    return () => {
        if (!fn || queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            fn();
        });
    };
}

export function setupPaneDrag(resizeAndRedraw) {
    let isDragging = false;
    const scheduleResize = makeRafScheduler(resizeAndRedraw);

    const setRightWidth = (clientX) => {
        const {layoutRect, dragWidth} = getPaneMetrics();
        const rawRightWidth = layoutRect.right - clientX - dragWidth;
        const appliedWidth = applyRightPaneWidth(rawRightWidth);
        if (appliedWidth !== null) preferredRightPaneWidth = appliedWidth;
        scheduleResize();
    };

    dragBar.addEventListener("pointerdown", (e) => {
        isDragging = true;
        preferredRightPaneWidth = rightPane.getBoundingClientRect().width;
        dragBar.setPointerCapture?.(e.pointerId);
        document.body.style.cursor = "ew-resize";
        e.preventDefault();
    });

    document.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        setRightWidth(e.clientX);
    });

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        dragBar.releasePointerCapture?.(e.pointerId);
        document.body.style.cursor = "default";
        reclampRightPane();
        scheduleResize();
    };

    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);

    new ResizeObserver(scheduleResize).observe(leftPane);
}

export function moveEffectInStack(effectStack, from, to) {
    if (from < 0 || from >= effectStack.length) return;
    to = Math.max(0, Math.min(to, effectStack.length));
    if (from === to) return;
    const [moved] = effectStack.splice(from, 1);
    effectStack.splice(to, 0, moved);
}


// top-level buttons
const saveBtn = gid("save-stack");
const clearBtn = gid("clear-stack");
const textarea = gid("stack-json");


export function setupStaticButtons(
    handleUpload,
    saveState,
    resetStack,
    requestRender,
    requestUIDraw,
    setFreezeAnimationButtonFlag
) {
    const uploadButton = gid('upload');
    uploadButton.addEventListener('change', handleUpload);
    saveBtn.addEventListener("click", () => {
        textarea.value = saveState();
        navigator.clipboard?.writeText(textarea.value).then(() =>
            console.log("Stack JSON copied to clipboard")
        );
    });
    clearBtn.addEventListener("click", () => {
        resetStack();
        requestUIDraw();
        requestRender();
    });
    const freezeBtn = gid("freezeAnimation")
    freezeBtn.addEventListener("click",
        () => {
            freezeBtn.classList.toggle("frozen");
            setFreezeAnimationButtonFlag(freezeBtn.classList.contains("frozen"))
        }
    )
    gid("randomStack").addEventListener("click", async () => await randomizeEffectStack());
}


// window setup
export function setupWindow(resizeAndRedraw) {
    const scheduleResize = makeRafScheduler(resizeAndRedraw);
    const handleViewportResize = () => {
        reclampRightPane();
        scheduleResize();
    };

    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    if (layout && 'ResizeObserver' in window) {
        new ResizeObserver(handleViewportResize).observe(layout);
    }
}


export function placeholderOption(text = "select") {
    const nullOpt = document.createElement('option');
    nullOpt.value = ""
    nullOpt.textContent = text;
    nullOpt.selected = true;
    nullOpt.disabled = true;
    nullOpt.hidden = true;
    return nullOpt;
}

function updatePresetSelect() {
    updateAppPresets();
    const select = document.getElementById('presetSelect');
    select.innerHTML = '';

    select.appendChild(placeholderOption("--preset--"));
    listAppPresets().sort().forEach((name) => {
        const opt = document.createElement('option');
        opt.textContent = name;
        select.appendChild(opt);
    });
}

export function setupPresetUI(
    getState, loadState, resetStack, requestRender, requestUIDraw, registry,
    lockRender, unlockRender
) {

    const presetSelect = document.getElementById('presetSelect');

    let running = false;
    let pendingName = null;

    presetSelect.addEventListener("change", () => {
      pendingName = presetSelect.value;
      void drainPresetLoads();
    });

    async function drainPresetLoads() {
      if (running) return;
      running = true;

      try {
        while (pendingName !== null) {
          const name = pendingName;
          pendingName = null;

          lockRender();
          try {
            resetStack();

            if (listAppPresets().includes(name)) {
              await loadState(getAppPresetView(name), registry, false);
            }

            requestUIDraw();
            requestRender();
          } finally {
            unlockRender();
          }
        }
      } catch (err) {
        console.error("Preset load failed:", err);
      } finally {
        running = false;
      }
    }

    document.getElementById('presetSave').onclick = () => {
        const name = prompt('Preset name?');
        if (!name) return;
        const config = getState();
        addUserPreset(name, config);
        updateAppPresets();
        updatePresetSelect();
    };

    document.getElementById('presetDelete').onclick = () => {
        const name = document.getElementById('presetSelect').value;
        deleteUserPreset(name);
        updateAppPresets();
        updatePresetSelect();
    };
    updatePresetSelect();
}

export function setupExportImage(exportImage) {
    document.getElementById('exportImage').onclick = exportImage;
}

export function setupVideoCapture(startCapture, stopCapture) {
    document.getElementById("startCapture").onclick = startCapture;
    document.getElementById("stopCaptureOverlay").onclick = stopCapture;
}


export function setupVideoExportModal() {
    const modal = document.getElementById("exportControlsModal");
    const openModalButton = document.getElementById("openExportControlsModal");
    const closeModalButton = document.getElementById("closeExportControlsModal");

    openModalButton.addEventListener("click", () => {
        modal.style.display = "block";
    });

    closeModalButton.addEventListener("click", () => {
        modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });
}

export function setupDragAndDrop(handleUpload) {
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files)
            .filter(f => f.type.startsWith('image/'));
        handleUpload(files[0]);
    });
}

function isProbablyMobile() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUA = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA || (isTouchDevice && isSmallScreen);
}

export function pruneForMobile(exportImage, loadState, resetStack, registry,
                               requestUIDraw, requestRender, startCapture) {
    if (!isProbablyMobile()) return;
    document.body.classList.add('mobile-mode');

    gid("rightPane").style.display = 'none';
    gid("leftPane").style.maxWidth = '100%';
    gid("leftPane").style.flexGrow = 1;
    gid("leftPane").style.flexShrink = 0;
    console.log('beep');
    const topBar = gid("topBar");
    topBar.innerHTML = `
        <button id="startCapture" title="Download WebM">🎥</button>
        <button id="exportImage" title="Download PNG">📷</button>
        <select id="presetSelect"></select>
        <select id="test-pattern-select"></select>
        <button id="randomStack" title="Randomize">🔀</button>
        <label for="upload" title="Choose File">⬆</label>
      `;
    updatePresetSelect();
    document.getElementById('presetSelect').addEventListener("change", async () => {
        const name = document.getElementById('presetSelect').value;
        if (listAppPresets().includes(name)) {
            resetStack();
            await loadState(getAppPresetView(name), registry, false);
        }
        requestUIDraw();
        requestRender();
    });
    document.getElementById('exportImage').onclick = () => {
        exportImage("full");
    };
    document.getElementById('startCapture').onclick = () => startCapture();
    gid("randomStack").addEventListener("click", async () => await randomizeEffectStack());
    populateTestSelect();
    gid("dragBar").remove();
    topBar.classList.add('mobile');
    gid("mainLayout").style.maxHeight = "80vh";
    gid("mobile-topbar-target").appendChild(topBar);
    gid("mobile-topbar-target").style.display = "block"
}
