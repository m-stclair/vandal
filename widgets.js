import {downsampleImageData, formatFloatWidth, imageDataHash} from "./utils/helpers.js";
import {clampAnimationParams} from "./utils/animutils.js";
import {requestRender, requestUIDraw} from "./state.js";



function makeField() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("field-row");
    return wrapper;
}

function logBase(x, base) {
    return Math.log(x) / Math.log(base);
}

function applyScaling(sliderValue, scale, scaleFactor) {
    const value = parseFloat(sliderValue);
    switch (scale) {
        case "log":
            return Math.pow(scaleFactor, value) - 1;
        case "lin":
            break;
        default:
            console.warn(
                `'${scale}' scaling not implemented, defaulting to linear`
            );
    }
    return value;
}

function clampInfinity(value, minval = 0.001) {
    return value === -Infinity ? minval : value
}

function reverseScaling(value, scale, scaleFactor) {
    switch (scale) {
        case "log":
            return clampInfinity(logBase(value + 1, scaleFactor));
        case "lin":
            break;
        default:
            console.warn(
                `'${scale}' scaling not implemented, defaulting to linear`
            );
    }
    return value;
}

function makeSubSlider(labelText, initialValue, min, max, step = 0.01) {
    const container = document.createElement("div");
    container.classList.add("mod-field");
    const label = document.createElement("span");
    label.textContent = labelText;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initialValue;
    container.append(label, slider);
    return {container, slider}
}

export function renderFoldoutToggle(state, label, onToggle) {
    const button = document.createElement('button');
    button.classList.add('foldout-toggle', 'group-header');
    button.textContent = (state.collapsed ? '▶' : '▼') + ' ' + label;
    button.onclick = () => {
        state.collapsed = !state.collapsed;
        onToggle?.();
    };
    return button;
}

function renderAnimationFoldout(animUIState, value, input, min, max, wrapper, config, key) {
    const modFoldout = document.createElement("div");
    modFoldout.classList.add("mod-drawer");
    const msWrapper = document.createElement("div");
    msWrapper.className = "mod-field";
    const modSelect = document.createElement("select");
    ["none", "sine", "square", "saw"].forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        modSelect.appendChild(opt);
    });
    msWrapper.appendChild(modSelect);
    const mod = config[key].mod;
    modSelect.value = mod?.type ?? "none";
    const defaultBias = parseFloat(applyScaling((input.max - input.min) / 2, input.scale, input.scaleFactor));
    const [safeBias, safeDepth] = clampAnimationParams(min ?? 0, max ?? 1, defaultBias);
    const depth = makeSubSlider("Depth", mod?.scale ?? safeDepth, 0, safeDepth);
    const bias = makeSubSlider("Bias", mod?.offset ?? safeBias, min ?? 0, max ?? 1);
    const freq = makeSubSlider("Rate", mod?.freq ?? 0.5, 0.01, 4, 0.01);
    const modActions = document.createElement("div");
    modActions.className = "mod-actions"
    const modReset = document.createElement("button");
    modReset.textContent = "⟳ Resync";
    modReset.className = "mod-reset";
    const modRemove = document.createElement("button");
    modRemove.textContent = "❌ Remove";
    modRemove.className = "mod-remove";
    modActions.appendChild(modReset);
    modActions.appendChild(modRemove);
    modFoldout.append(
        modSelect,
        depth.container,
        bias.container,
        freq.container,
    );
    const applyModState = (e) => {
        e.stopPropagation();
        const modType = modSelect.value;
        const modulated = modType !== "none";

        input.disabled = modulated;
        wrapper.classList.toggle("modulated", modulated);
        config[key] = {
            value: parseFloat(applyScaling(input.value, input.scale, input.scaleFactor)),
            mod: modulated ? {
                type: modType,
                freq: parseFloat(freq.slider.value),
                phase: 0,
                scale: parseFloat(depth.slider.value),
                offset: parseFloat(bias.slider.value),
            } : {type: "none"},
        };
        if (modulated && animUIState.animating !== true) {
            requestUIDraw();
            requestRender();
        } else if (!modulated && animUIState.animating === true) {
            requestUIDraw();
        }
        animUIState.animating = modulated;
    };

    modSelect.addEventListener("change", applyModState);
    [depth.slider, bias.slider, freq.slider].forEach(el =>
        el.addEventListener("input", applyModState)
    );
    return modFoldout;

}

function makeSlider(id, config, uiSpec, fxUIState, canAnimate = false) {
    const {scale, min, max, step, steps, scaleFactor, key, label} = uiSpec;
    const value = config[key]?.value || config[key];
    const wrapper = makeField();
    wrapper.classList.add("row-slider");
    if (!canAnimate) {
        wrapper.classList.add("no-animate");
    }
    const row = document.createElement("div");
    row.classList.add("slider-wrapper");
    wrapper.dataset.key = key;
    if (id) wrapper.dataset.fxId = id;

    const lElement = document.createElement("label");
    lElement.textContent = label ?? key;
    wrapper.appendChild(lElement);

    const input = document.createElement("input");
    input.type = "range";
    input.scale = scale ?? 'lin';
    input.scaleFactor = scaleFactor ?? 10;
    const baseValue = typeof value === "object" ? value.value ?? value.base : value;
    input.min = reverseScaling(min ?? 0, input.scale, input.scaleFactor);
    input.max = reverseScaling(max ?? 1, input.scale, input.scaleFactor);
    input.step = steps ? (input.max - input.min) / steps :
        reverseScaling(step ?? 0.01, input.scale, input.scaleFactor);
    input.value = reverseScaling(baseValue, input.scale, input.scaleFactor);
    input.name = key;
    input.classList.add("slider");

    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.classList.add("slider-value");
    valueInput.name = `${key}-value`;
    valueInput.value = input.value;
    valueInput.min = input.min;
    valueInput.max = input.max;
    valueInput.step = input.step;

    row.append(input, valueInput);
    wrapper.appendChild(row);

    let foldout = null;
    if (canAnimate) {
        const animUIState = fxUIState[key].animation;
        if (!Object.keys(animUIState).includes("collapsed")) {
            animUIState.collapsed = true;
        }
        const foldoutButton = document.createElement("button");

        foldoutButton.classList.add("mod-icon")
        foldoutButton.textContent = "◔"
        foldoutButton.title = "edit modulation"
        foldoutButton.addEventListener("click", () => {
            animUIState.collapsed = !animUIState.collapsed;
            requestUIDraw();
        })
        lElement.appendChild(foldoutButton);
        lElement.classList.add("label-with-mod")
        row.classList.add("has-animation-foldout")
        if (!animUIState.collapsed) {
            foldout = renderAnimationFoldout(
                animUIState, value, input, min, max, wrapper, config, key
            );
        }
        if ((config[key].mod) && (config[key].mod.type !== "none")) {
            input.disabled = true;
            foldoutButton.classList.add("animating")
        }
    }

    input.addEventListener("input", (e) => {
        e.stopPropagation();
        const scaled = applyScaling(input.value, input.scale, input.scaleFactor);
        valueInput.value = formatFloatWidth(scaled);
        if (typeof (config[key]) !== "object") {
            config[key] = scaled;
        } else {
            config[key] = {
                value: scaled,
                mod: config[key]?.mod || {type: "none"},
            };
        }
        requestRender();
    });

    function valueUpdate() {
        input.value = valueInput.value;
        if (typeof (config[key]) !== "object") {
            config[key] = input.value;
        } else {
            config[key] = {
                value: input.value,
                mod: config[key]?.mod || {type: "none"},
            };
        }
        requestRender();
    }

    let prevValue = valueInput.value;
    valueInput.addEventListener('input', () => {
        const parsed = parseFloat(valueInput.value);
        const delta = parsed - prevValue;
        if (Math.abs(delta) === Number(valueInput.step)) {
            prevValue = parsed;
            valueUpdate();
        }
    });
    valueInput.addEventListener('blur', () => {
        valueUpdate();
    });

    valueInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            valueUpdate();
        }
    });
    return [wrapper, foldout];
}

function makeMatrixSlider(id, config, uiSpec) {
    let {key, min, max, step, rowLabels, colLabels, size} = uiSpec;
    const value = config[key];
    const wrapper = makeField();
    wrapper.dataset.key = key;
    if (id) wrapper.dataset.fxId = id;

    const container = document.createElement("div");
    container.classList.add("matrix-slider-group");

    const rowText = rowLabels(config);
    const colText = colLabels(config);
    // console.log(rowText, colText)
    for (let row = 0; row < size[0]; row++) {
        const rowWrapper = makeField(); // for each row
        const rowLabel = document.createElement("label");
        rowLabel.textContent = rowText[row] ?? `Row ${row + 1}`;
        rowWrapper.appendChild(rowLabel);

        const rowDiv = document.createElement("div");
        rowDiv.classList.add("vector-slider-row");

        for (let col = 0; col < size[1]; col++) {
            const slider = document.createElement("input");
            slider.type = "range";
            slider.min = min;
            slider.max = max;
            slider.step = step;
            slider.value = value[row][col];
            const valueLabel = document.createElement("span");
            valueLabel.classList.add("slider-value");
            valueLabel.textContent = formatFloatWidth(slider.value);

            slider.addEventListener("input", (e) => {
                e.stopPropagation();
                const newVal = parseFloat(slider.value);
                config[key][row][col] = newVal;
                valueLabel.textContent = formatFloatWidth(newVal);
                requestRender();
            });

            const cell = document.createElement("div");
            cell.classList.add("field-row");

            const colLabel = document.createElement("span");
            colLabel.textContent = colText[col] ?? `#${col}`;

            cell.append(colLabel, slider, valueLabel);
            rowDiv.appendChild(cell);
        }

        rowWrapper.appendChild(rowDiv);
        container.appendChild(rowWrapper);
    }

    wrapper.appendChild(container);
    return wrapper;
}

function makeVectorSlider(id, config, uiSpec) {
    let {key, label, length, subLabels, min, max, step} = uiSpec;
    let value = config[key];
    subLabels = typeof subLabels === "function" ? subLabels(config) : subLabels
    if (!length) {
        length = subLabels.length;
    }
    const wrapper = makeField();
    wrapper.dataset.key = key;
    if (id) wrapper.dataset.fxId = id;

    const lElement = document.createElement("label");
    lElement.textContent = label ?? key;
    wrapper.appendChild(lElement);

    const row = document.createElement("div");
    row.classList.add("field-row", "vector-vertical");
    const stack = document.createElement("div");
    stack.classList.add("vector-stack");
    row.appendChild(stack);
    for (let i = 0; i < length; i++) {
        const channel = document.createElement("div");
        channel.classList.add("vec-row");
        const subLabel = subLabels[i] ?? `#${i}`;
        const slider = document.createElement("input");
        slider.classList.add("vec-slider")
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value[i];
        const valueInput = document.createElement("input");
        valueInput.classList.add("vec-number");
        valueInput.value = formatFloatWidth(slider.value);
        // TODO: _god_ this is wordy and repetitive
        slider.addEventListener("input", () => {
            config[key][i] = parseFloat(slider.value);
            if (parseFloat(slider.value) === undefined) {
                throw new Error('wtf');
            }
            valueInput.value = formatFloatWidth(slider.value);
            requestRender();
        });
        function valueUpdate() {
            slider.value = valueInput.value;
            if (typeof (config[key]) !== "object") {
                config[key] = slider.value;
            } else {
                config[key] = {
                    value: slider.value,
                    mod: config[key]?.mod || {type: "none"},
                };
            }
            requestRender();
        }
        let prevValue = valueInput.value;
        valueInput.addEventListener('input', () => {
            const parsed = parseFloat(valueInput.value);
            const delta = parsed - prevValue;
            if (Math.abs(delta) === Number(valueInput.step)) {
                prevValue = parsed;
                valueUpdate();
            }
        });
        valueInput.addEventListener('blur', () => {
            valueUpdate();
        });
        valueInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                valueUpdate();
            }
        });
        const labelEl = document.createElement("span");
        labelEl.classList.add("vec-label")
        labelEl.textContent = subLabel;
        channel.append(labelEl, slider, valueInput);
        stack.appendChild(channel);
    }

    wrapper.appendChild(row);
    return wrapper;
}

function Checkbox(id, config, uiSpec) {
    const {key, label} = uiSpec;
    const value = config[key];
    const wrapper = makeField();
    wrapper.classList.add("row-toggle");
    const lElement = document.createElement('label');
    lElement.className = 'checkbox-label';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = value;
    input.name = key

    lElement.appendChild(input);
    lElement.append(` ${label}`);
    wrapper.appendChild(lElement);

    Object.defineProperty(wrapper, 'value', {
        'get': () => input.checked
    })
    input.addEventListener('input', () => {
        wrapper.dispatchEvent(new Event('input'));
    });

    return wrapper;
}

function Select(id, config, uiSpec) {
    const {key, label, options} = uiSpec;
    const value = config[key];
    const wrapper = makeField();
    wrapper.classList.add("row-select")
    const lElement = document.createElement('label');
    lElement.textContent = label || key;
    wrapper.appendChild(lElement);

    const select = document.createElement('select');

    for (const opt of options) {
        const {value: val, label: lbl} =
            typeof opt === "string" ? {value: opt, label: opt} : opt;
        const o = document.createElement('option');
        o.value = val;
        o.textContent = lbl;
        if (val === value || val === Number.parseInt(value)) o.selected = true;
        select.appendChild(o);
    }

    select.name = key;
    wrapper.appendChild(select);

    Object.defineProperty(wrapper, 'value', {
        get: () => select.value
    });

    select.addEventListener('input', () =>
        wrapper.dispatchEvent(new Event('input'))
    );

    return wrapper;
}

function ReferenceImage(id, config, uiSpec, fx) {
    const {key, label} = uiSpec;
    const container = document.createElement("div");
    container.className = "widget";

    const labelElement = document.createElement("label");
    labelElement.textContent = label || "Reference Image";

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        if (!file) return;

        const imageBitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = imageBitmap.width;
        canvas.height = imageBitmap.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imageBitmap, 0, 0);
        const fullImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        fx.auxiliaryCache.referenceImage = await downsampleImageData(fullImage);
        fx.config[key] = imageDataHash(fx.auxiliaryCache.referenceImage);
    })
    container.appendChild(labelElement);
    container.appendChild(input);
    return container;
}

export default {
    formatFloatWidth,
    makeSlider,
    makeMatrixSlider,
    makeVectorSlider,
    Select,
    Checkbox,
    ReferenceImage,
};