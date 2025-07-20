import {gid} from "./utils/helpers.js";
import {
    addUserPreset,
    listAppPresets,
    getAppPresetView,
    deleteUserPreset,
    updateAppPresets,
} from "./utils/presets.js";
// pane dragging logic

const dragBar = document.getElementById("dragBar");
const leftPane = document.getElementById("leftPane");
const layout = document.getElementById("mainLayout");

export function setupPaneDrag() {
    let isDragging = false;
    const leftWidth = leftPane.getBoundingClientRect().width;
    dragBar.style.left = `${leftWidth}px`;

    dragBar.addEventListener("mousedown", (e) => {
        isDragging = true;
        document.body.style.cursor = "ew-resize";
        e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        const layoutRect = layout.getBoundingClientRect();
        const minLeft = 100;
        const maxLeft = layoutRect.width - 200; // leave min space for rightPane

        const newLeft = Math.min(Math.max(e.clientX - layoutRect.left, minLeft), maxLeft);

        leftPane.style.flex = `0 0 ${newLeft}px`;
    });

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            document.body.style.cursor = "default";
        }
    });
}


// effect stack container

const effectStackElement = document.getElementById("effectStack");

export function moveEffectInStack(effectStack, from, to) {
    if (from < 0 || from >= effectStack.length) return;
    to = Math.max(0, Math.min(to, effectStack.length));
    if (from === to) return;
    const [moved] = effectStack.splice(from, 1);
    effectStack.splice(to, 0, moved);
}

// shared rendering objects
export const canvas = document.getElementById('glitchCanvas');
export const defaultCtx = canvas.getContext("2d", {willReadFrequently: true});


// top-level buttons
const uploadButton = gid('upload');
const saveBtn = gid("save-stack");
const loadBtn = gid("load-stack");
const clearBtn = gid("clear-stack");
const textarea = gid("stack-json");


export function setupStaticButtons(
    handleUpload, addSelectedEffect, saveState,
    loadState, registry, resetStack, requestRender,
    requestUIDraw
) {
    uploadButton.addEventListener('change', handleUpload);
    saveBtn.addEventListener("click", () => {
        textarea.value = saveState();
        navigator.clipboard?.writeText(textarea.value).then(() =>
            console.log("Stack JSON copied to clipboard")
        );
    });
    loadBtn.addEventListener("click", () => {
        loadState(textarea.value, registry);
        requestUIDraw();
        requestRender();
    });
    clearBtn.addEventListener("upclick", () => {
        resetStack();
        requestUIDraw();
        requestRender();
    });
}


// effect selector
export const addEffectSelect = gid('addEffect');

export function buildEffectSelect(effectGroups) {
    addEffectSelect.add(new Option("-- pick an effect --", "", true, true));
    Object.entries(effectGroups).forEach((group) => {
        const [label, effects] = group;
        const optgroup = document.createElement("optgroup");
        optgroup.label = label;
        effects.forEach(mod => {
            const opt = new Option(mod.name, mod.name);
            optgroup.appendChild(opt);
        });
        addEffectSelect.appendChild(optgroup);
    });
}

export function initEffectBrowser(effectRegistry) {
    const allTags = new Set();
    Object.values(effectRegistry).forEach(entry => entry.meta.tags.forEach(tag => allTags.add(tag)));

    const tagFilters = document.getElementById("tag-filters");
    const effectList = document.getElementById("effect-list");
    const searchInput = document.getElementById("searchInput");
    let activeTags = new Set();

    function renderTags() {
        tagFilters.innerHTML = "";
        allTags.forEach(tag => {
            const div = document.createElement("div");
            div.textContent = tag;
            div.className = "tag";
            if (activeTags.has(tag)) div.classList.add("active");
            div.onclick = () => {
                if (activeTags.has(tag)) activeTags.delete(tag);
                else activeTags.add(tag);
                renderEffectList();
                renderTags();
            };
            tagFilters.appendChild(div);
        });
    }

    function renderEffectList() {
        const search = searchInput.value.toLowerCase();
        effectList.innerHTML = "";
        Object.values(effectRegistry).forEach(entry => {
            const {name, meta} = entry;
            const matchesSearch = name.toLowerCase().includes(search) || meta.description.toLowerCase().includes(search);
            const matchesTags = [...activeTags].every(tag => meta.tags.includes(tag));
            if (matchesSearch && matchesTags) {
                const tile = document.createElement("div");
                tile.className = "effect-tile";
                tile.innerHTML = `<div class="effect-name">${name}</div><div class="effect-desc">${meta.description}</div>`;
                tile.onclick = () => alert(`Selected: ${name}`);
                effectList.appendChild(tile);
            }
        });
    }

    searchInput.oninput = renderEffectList;
    renderTags();
    renderEffectList();
}

// window setup (currently just resize trigger)
export function setupWindow(resizeAndRedraw) {
    window.addEventListener('resize', resizeAndRedraw);
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

    select.appendChild(placeholderOption("-- select preset --"));
    listAppPresets().sort().forEach((name) => {
        const opt = document.createElement('option');
        opt.textContent = name;
        select.appendChild(opt);
    });
}

export function setupPresetUI(
    getState, loadState, requestRender, requestUIDraw, registry
) {

    document.getElementById('presetLoad').onclick = async () => {
        const name = document.getElementById('presetSelect').value;
        if (listAppPresets().includes(name)) {
            await loadState(getAppPresetView(name), registry, false);
        }
        requestUIDraw();
        requestRender();
    };

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
    document.getElementById('exportImage').onclick = () => {
        exportImage(document.getElementById("exportImageResolution").value);
    };
}

export function setupVideoCapture(startCapture, stopCapture) {
    document.getElementById('startCapture').onclick = () => startCapture();
    document.getElementById('stopCaptureOverlay').onclick = stopCapture();
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

const dropZone = document.getElementById('drop-zone-fullscreen');

// const fileInput = document.getElementById('file-input');

export function setupDragAndDrop(handleUpload) {
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files)
        .filter(f => f.type.startsWith('image/'));
      handleUpload(files[0]);
    });
}

