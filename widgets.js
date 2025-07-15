// widgets.js
import {downsampleImageData, formatFloatWidth, imageDataHash} from "./utils/helpers.js";
import {clampAnimationParams} from "./utils/animutils.js";


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

function makeSlider({
                        key,
                        label,
                        value,
                        min,
                        max,
                        step,
                        scale,
                        scaleFactor,
                        steps,
                        modulate = false,
                        config,
                        update,
                        id
                    }) {
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

    if (modulate) {
        const modFoldout = document.createElement("details");
        modFoldout.classList.add("mod-foldout");
        modFoldout.open = false;
        const summary = document.createElement("summary");
        summary.textContent = "Animation";
        modFoldout.appendChild(summary);

        const modSelect = document.createElement("select");
        ["none", "sine", "square", "saw"].forEach(type => {
            const opt = document.createElement("option");
            opt.value = opt.text = type;
            modSelect.appendChild(opt);
        });
        modSelect.value = value?.mod?.type ?? "none";

        const defaultBias = parseFloat(applyScaling((input.max - input.min) / 2, input.scale, input.scaleFactor));
        const defaultRangeMode = value?.mod?.rangeMode ?? "bipolar";
        const [safeBias, safeDepth] = clampAnimationParams(min ?? 0, max ?? 1, defaultBias, defaultRangeMode);

        const depth = makeSubSlider("Depth", value?.mod?.scale ?? safeDepth, 0, safeDepth);
        const bias = makeSubSlider("Bias", value?.mod?.offset ?? safeBias, min ?? 0, max ?? 1);
        const freq = makeSubSlider("Rate", value?.mod?.freq ?? 0.5, 0.01, 4, 0.01);
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
            update();
        };

        modSelect.addEventListener("change", applyModState);
        [depth.slider, bias.slider, freq.slider, rangeModeSelect].forEach(el =>
            el.addEventListener("input", applyModState)
        );
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
        update();
    });

    return wrapper;
}

function makeMatrixSlider({
                              key,
                              label,
                              value,
                              size = [3, 3], // rows x cols
                              min = -1,
                              max = 1,
                              step = 0.01,
                              scale,
                              scaleFactor,
                              steps,
                              rowLabels = () => ["Row 1", "Row 2", "Row 3"],
                              colLabels = () => ["X", "Y", "Z"],
                              config,
                              update,
                              id
                          }) {
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
                update();
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

function makeVectorSlider({
                              key,
                              label,
                              value,
                              length = 3,
                              min = 0,
                              max = 1,
                              step = 0.01,
                              subLabels = ["X", "Y", "Z"],
                              config,
                              update,
                              id
                          }) {
    subLabels = typeof subLabels === "function" ? subLabels(config) : subLabels
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
            update();
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

function Checkbox({key, label, value}) {
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

function Select({key, label, options, value}) {
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
        if (val === value) o.selected = true;
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

function ReferenceImage(key, labelText, instance, onChange) {
    const container = document.createElement("div");
    container.className = "widget";

    const label = document.createElement("label");
    label.textContent = labelText || "Reference Image";

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
        instance.auxiliaryCache.referenceImage = await downsampleImageData(fullImage);
        instance.config[key] = imageDataHash(instance.auxiliaryCache.referenceImage);
    })
    container.appendChild(label);
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
    Range(opts) {
        return makeSlider({...opts, modulate: false});
    },
    makeModSlider(opts) {
        return makeSlider({...opts, modulate: true});
    },
};
