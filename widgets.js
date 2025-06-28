import {downsampleImageData, imageDataHash, showImageData} from "./utils.js";

function makeField() {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    return wrapper;
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

    Range({key, label, value, min, max, step}) {
        const wrapper = makeField();

        const lElement = document.createElement('label');
        lElement.textContent = label;
        wrapper.appendChild(lElement);

        const row = document.createElement("div");
        row.classList.add("slider-row");

        const input = document.createElement('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.step = step ?? '1';
        input.value = value;
        input.name = key;
        input.classList.add('slider');

        wrapper.appendChild(input);

        const valueLabel = document.createElement("span");
        valueLabel.textContent = input.value;
        valueLabel.style.marginLeft = "0.5em";
        valueLabel.classList.add("slider-value")
        wrapper.appendChild(valueLabel);

        Object.defineProperty(wrapper, 'value', {
            'get': () => parseFloat(input.value)
        })
        input.addEventListener('input', () => {
            valueLabel.textContent = input.value;
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