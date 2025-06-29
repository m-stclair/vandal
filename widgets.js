import {downsampleImageData, imageDataHash, showImageData} from "./utils/helpers.js";

function formatFloatWidth(val, maxChars = 5) {
    if (!Number.isFinite(val)) return String(val).slice(0, maxChars);

    if (val === 0) return val;

    const abs = Math.abs(val);

    // Prefer fixed-point if it'll fit
    let fixed = abs >= 1e-3 && abs < 1e6
    ? val.toFixed(Math.max(0, maxChars - String(Math.trunc(val)).length - 1))
    : null;

    if (fixed) {
        fixed = fixed.replace(/\.?0+$/, ''); // Trim trailing .0s
    } 
    if (fixed && fixed.length <= maxChars) {
        return fixed;
    }

    // Fall back to exponential
    let expDigits = maxChars - 5; // 1e+00 is 5 chars minimum
    if (expDigits < 0) expDigits = 0;

    return val.toExponential(expDigits)
            .replace(/\.?0+e/, 'e')       // Trim unneeded .0s
            .replace(/e\+?(-?)0*(\d+)/, 'e$1$2'); // Trim leading 0s in exponent
}


function logBase(x, base) {
  return Math.log(x) / Math.log(base);
}

function makeField() {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    return wrapper;
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

export default {
    Checkbox({key, label, value}) {
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
    },

    Select({ key, label, options, value }) {
        const wrapper = makeField();

        const lElement = document.createElement('label');
        lElement.textContent = label || key;
        wrapper.appendChild(lElement);

        const select = document.createElement('select');

        for (const opt of options) {
            const { value: val, label: lbl } =
                typeof opt === "string" ? { value: opt, label: opt } : opt;
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
    },

    Range({key, label, value, min, max, step, steps, scale, scaleFactor}) {
        const wrapper = makeField();

        const lElement = document.createElement('label');
        lElement.textContent = label;
        wrapper.appendChild(lElement);

        const row = document.createElement("div");
        row.classList.add("slider-row");

        const input = document.createElement('input');
        input.type = 'range';
        input.scale = scale ?? 'lin';
        input.scaleFactor = scaleFactor ?? 10;
        input.min = reverseScaling(min, input.scale, input.scaleFactor);
        input.max = reverseScaling(max, input.scale, input.scaleFactor);
        if (steps) {
            input.step = (input.max - input.min) / steps
        } else {
            input.step = reverseScaling(
                step === undefined ? 1 : step, input.scale, input.scaleFactor
            );
        }
        input.value = reverseScaling(value, input.scale, input.scaleFactor);
        input.name = key;
        input.classList.add('slider')

        wrapper.appendChild(input);

        const valueLabel = document.createElement("span");
        valueLabel.textContent = formatFloatWidth(
            applyScaling(input.value, input.scale, input.scaleFactor)
        );
        valueLabel.style.marginLeft = "0.5em";
        valueLabel.classList.add("slider-value")
        wrapper.appendChild(valueLabel);

        Object.defineProperty(wrapper, 'value', {
            'get': () => applyScaling(input.value, input.scale, input.scaleFactor)
        })
        input.addEventListener('input', () => {
            valueLabel.textContent = formatFloatWidth(
                applyScaling(input.value, input.scale, input.scaleFactor)
            );
            wrapper.dispatchEvent(new Event('input'));
        });

        row.appendChild(input);
        row.appendChild(valueLabel);
        wrapper.appendChild(row);
        return wrapper;
    },

    ReferenceImage(key, labelText, instance, onChange) {
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
            const downsampledImage = await downsampleImageData(fullImage);
            instance.auxiliaryCache.referenceImage = downsampledImage;
            instance.config[key] = imageDataHash(instance.auxiliaryCache.referenceImage);
        })
        container.appendChild(label);
        container.appendChild(input);
        return container;
    }

}