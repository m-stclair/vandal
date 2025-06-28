import {gid} from "./utils.js";
// pane dragging logic

const dragBar = document.getElementById("dragBar");
const rightPane = document.getElementById("rightPane");
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
        // const startX = e.clientX;
        // const startWidth = rightPane.getBoundingClientRect().width;
        //
        // const onMouseMove = (e) => {
        //     const dx = startX - e.clientX;
        //     const newWidth = startWidth + dx;
        //     if (newWidth > 200 && newWidth < window.innerWidth - 100) {
        //         rightPane.style.width = `${newWidth}px`;
        //     }
        // };
        //
        // const onMouseUp = () => {
        //     document.body.style.cursor = "";
        //     document.removeEventListener("mousemove", onMouseMove);
        //     document.removeEventListener("mouseup", onMouseUp);
        // };
        //
        // document.addEventListener("mousemove", onMouseMove);
        // document.addEventListener("mouseup", onMouseUp);
    // });
}


// effect stack container

const effectStackElement = document.getElementById("effectStack");

export function setupEffectStackDragAndDrop(
    effectStack,
    clearRenderCache,
    updateApp
) {
    effectStackElement.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", e.target.dataset.index);
    });

    effectStackElement.addEventListener("dragover", (e) => {
        e.preventDefault();
        const target = e.target.closest("div");
        if (target && effectStackElement.contains(target)) {
            target.style.borderTop = "2px solid #999";
        }
    });

    effectStackElement.addEventListener("dragleave", (e) => {
        const target = e.target.closest("div");
        if (target) target.style.borderTop = "";
    });

    effectStackElement.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const toDiv = e.target.closest("div");
        if (!toDiv) return;

        const to = parseInt(toDiv.dataset.index, 10);
        if (from === to) return;

        const moved = effectStack.splice(from, 1)[0];
        effectStack.splice(to, 0, moved);

        // invalidate cache
        clearRenderCache()

        // Rerender
        updateApp();
    });
}


// shared rendering objects

export const canvas = document.getElementById('glitchCanvas');
export const ctx = canvas.getContext("2d", { willReadFrequently: true });


// top-level buttons
const uploadButton = gid('upload');
const addEffectButton = gid('addEffectBtn');
const saveBtn = gid("save-stack");
const loadBtn = gid("load-stack");
const clearBtn = gid("clear-stack");
const textarea = gid("stack-json");


export function setupStaticButtons(
    handleUpload, addSelectedEffect, saveState,
    loadState, registry, resetStack, update
) {
    uploadButton.addEventListener('change', handleUpload);
    addEffectButton.addEventListener('click', addSelectedEffect);
    saveBtn.addEventListener("click", () => {
        textarea.value = saveState();
        navigator.clipboard?.writeText(textarea.value).then(() =>
            console.log("Stack JSON copied to clipboard")
        );
    });
    loadBtn.addEventListener("click", () => {
        loadState(textarea.value, registry);
        update();
    });
    clearBtn.addEventListener("upclick", () => {
        resetStack();
        update();
    });
}


// effect selector
export const addEffectSelect = gid('addEffect');

export function buildEffectSelect(effectGroups) {

    addEffectSelect.add(new Option("-- Add Effect --", "", true, true));
    effectGroups.forEach(group => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = group.label;
        group.effects.forEach(mod => {
            const opt = new Option(mod.name, mod.name);
            optgroup.appendChild(opt);
        });
        addEffectSelect.appendChild(optgroup);
    });
}

// window setup (currently just resize trigger)
export function setupWindow(resizeAndRedraw) {
    window.addEventListener('resize', resizeAndRedraw);
}
