// widgets.js
import {downsampleImageData, formatFloatWidth, imageDataHash} from "./utils/helpers.js";
import {clampAnimationParams} from "./utils/animutils.js";
import {requestRender, requestUIDraw} from "./state.js";


function makeLabeledInput(labelText, element) {
    const wrapper = document.createElement("label");
    wrapper.classList.add("mod-subfield");
    wrapper.textContent = labelText;
    wrapper.appendChild(element);
    return wrapper;
}

function makeField() {
    const wrapper = document.createElement("div");
    wrapper.classList.add("ui-field");
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
    container.classList.add("sub-slider-container");
    const label = document.createElement("span");
    label.textContent = labelText;
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = initialValue;
    container.append(label, slider);
    return {container, slider};
}

export function renderFoldoutToggle(state, label, onToggle) {
    const button = document.createElement('button');
    button.className = 'foldout-toggle';
    button.textContent = (state.collapsed ? '▶' : '▼') + ' ' + label;
    button.onclick = () => {
        state.collapsed = !state.collapsed;
        onToggle?.();
    };
    const div = document.createElement("div");
    div.appendChild(button);
    return div;
}

function renderAnimationFoldout(animUIState, value, input, min, max, wrapper, config, key) {
    const modFoldout = document.createElement("div");
    modFoldout.classList.add("mod-foldout");
    const modSelect = document.createElement("select");
    ["none", "sine", "square", "saw"].forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        modSelect.appendChild(opt);
    });
    const mod = config[key].mod;
    modSelect.value = mod?.type ?? "none";
    const defaultBias = parseFloat(applyScaling((input.max - input.min) / 2, input.scale, input.scaleFactor));
    const defaultRangeMode = mod?.rangeMode ?? "bipolar";
    const [safeBias, safeDepth] = clampAnimationParams(min ?? 0, max ?? 1, defaultBias, defaultRangeMode);
    const depth = makeSubSlider("Depth", mod?.scale ?? safeDepth, 0, safeDepth);
    const bias = makeSubSlider("Bias", mod?.offset ?? safeBias, min ?? 0, max ?? 1);
    const freq = makeSubSlider("Rate", mod?.freq ?? 0.5, 0.01, 4, 0.01);
    const rangeModeSelect = document.createElement("select");
    ["bipolar", "unipolar"].forEach(mode => {
        const opt = document.createElement("option");
        opt.value = opt.text = mode;
        rangeModeSelect.appendChild(opt);
    });
    rangeModeSelect.value = value?.mod?.rangeMode ?? "bipolar";
    modFoldout.append(
        makeLabeledInput("Type", modSelect),
        makeLabeledInput("Depth", depth.container),
        makeLabeledInput("Bias", bias.container),
        makeLabeledInput("Rate", freq.container),
        makeLabeledInput("Range", rangeModeSelect)
    );

    wrapper.appendChild(modFoldout);

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
                rangeMode: rangeModeSelect.value,
                scale: parseFloat(depth.slider.value),
                offset: parseFloat(bias.slider.value),
            } : {type: "none"},
        };
        requestRender();
    };

    modSelect.addEventListener("change", applyModState);
    [depth.slider, bias.slider, freq.slider, rangeModeSelect].forEach(el =>
        el.addEventListener("input", applyModState)
    );
    return modFoldout;

}

function makeSlider(id, config, uiSpec, fxUIState, canAnimate = false) {
    const {scale, min, max, step, steps, scaleFactor, key, label} = uiSpec;
    const value = config[key]?.value || config[key];
    const wrapper = makeField();
    const row = document.createElement("div");
    row.classList.add("slider-row");
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

    const valueLabel = document.createElement("span");
    valueLabel.classList.add("slider-value");
    valueLabel.style.marginLeft = "0.5em";
    valueLabel.textContent = formatFloatWidth(applyScaling(input.value, input.scale, input.scaleFactor));

    row.append(input, valueLabel);
    wrapper.appendChild(row);

    if (canAnimate) {
        const animUIState = fxUIState[key].animation;
        if (!Object.keys(animUIState).includes("collapsed")) {
            animUIState.collapsed = true;
        }
        const foldoutToggle = renderFoldoutToggle(
            animUIState, "animation", requestUIDraw
        );
        foldoutToggle.classList.add("animation-toggle")
        wrapper.appendChild(foldoutToggle);
        row.classList.add("has-animation-foldout")
        if (!animUIState.collapsed) {
            const foldout = renderAnimationFoldout(
                animUIState, value, input, min, max, wrapper, config, key
            );
            wrapper.appendChild(foldout);
        }
        if ((config[key].mod) && (config[key].mod.type !== "none")) {
            input.disabled = true;
        }
    }

    input.addEventListener("input", (e) => {
        e.stopPropagation();
        const scaled = applyScaling(input.value, input.scale, input.scaleFactor);
        valueLabel.textContent = formatFloatWidth(scaled);
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
    return wrapper;
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
            cell.classList.add("sub-slider-container");

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
    row.classList.add("vector-slider-row");

    for (let i = 0; i < length; i++) {
        const subLabel = subLabels[i] ?? `#${i}`;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value[i];

        const valueLabel = document.createElement("span");
        valueLabel.classList.add("slider-value");
        valueLabel.textContent = formatFloatWidth(slider.value);

        slider.addEventListener("input", () => {
            config[key][i] = parseFloat(slider.value);
            valueLabel.textContent = formatFloatWidth(slider.value);
            requestRender();
        });

        const container = document.createElement("div");
        container.classList.add("sub-slider-container");

        const labelEl = document.createElement("span");
        labelEl.textContent = subLabel;

        container.append(labelEl, slider, valueLabel);
        row.appendChild(container);
    }

    wrapper.appendChild(row);
    return wrapper;
}

function Checkbox(id, config, uiSpec) {
    const {key, label} = uiSpec;
    const value = config[key];
    const wrapper = makeField();

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
    lElement.appendChild(select);

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