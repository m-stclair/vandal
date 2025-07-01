import widgets from "./widgets.js"

// ui_builder.js
export function buildUI(instance, container, config, update, layout) {
    container.innerHTML = ''; // Clear old UI

    // Group layout items by group key
    const grouped = {};
    layout.forEach(item => {
        const group = item.group ?? '__default__';
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(item);
    });

    for (const [groupName, items] of Object.entries(grouped)) {
        let section;
        let inner;

        if (groupName === '__default__') {
            section = document.createElement('div');
            inner = section;
        } else {
            section = document.createElement('details');
            section.open = true;
            const summary = document.createElement('summary');
            summary.textContent = groupName;
            section.appendChild(summary);
            inner = document.createElement('div');
            section.appendChild(inner);
        }

        items.forEach(item => {
            const {type, key, label} = item;
            const value = config[key];
            let widget;

            switch (type.toLowerCase()) {
                case 'range':
                    widget = widgets.Range({
                        config,
                        key,
                        label,
                        value,
                        scale: item.scale,
                        min: item.min,
                        max: item.max,
                        step: item.step,
                        steps: item.steps,
                        scaleFactor: item.scaleFactor,
                        update: update,
                        id: item.id
                    });
                    break;
                case 'modslider':
                    widget = widgets.makeModSlider({
                        config,
                        key,
                        label,
                        value,
                        id: instance.id,
                        scale: item.scale,
                        min: item.min,
                        max: item.max,
                        step: item.step,
                        steps: item.steps,
                        scaleFactor: item.scaleFactor,
                        update: update
                    });
                    break;
                case 'matrix':
                    widget = widgets.makeMatrixSlider({
                        config,
                        key,
                        label,
                        value,
                        id: instance.id,
                        scale: item.scale,
                        min: item.min,
                        max: item.max,
                        step: item.step,
                        steps: item.steps,
                        scaleFactor: item.scaleFactor,
                        update: update,
                        rowLabels: item.rowLabels,
                        colLabels: item.colLabels
                    });
                    break;

                case 'select':
                    widget = widgets.Select({key, label, value, options: item.options});
                    break;
                case 'checkbox':
                    widget = widgets.Checkbox({key, label, value});
                    break;
                case 'referenceimage':
                    widget = widgets.ReferenceImage(key, label, instance, update);
                    break;
                case 'vector':
                    widget = widgets.makeVectorSlider({
                        config,
                        key,
                        label,
                        value,
                        length: item.length,
                        id: instance.id,
                        scale: item.scale,
                        min: item.min,
                        max: item.max,
                        step: item.step,
                        steps: item.steps,
                        scaleFactor: item.scaleFactor,
                        update: update,
                        subLabels: item.subLabels
                    });
                    break;
                default:
                    console.warn(`Unknown widget type: ${type}`);
                    return;
            }

            if (type.toLowerCase() === 'select' || type.toLowerCase() === 'checkbox') {
                widget.addEventListener('input', () => {
                    config[key] = widget.value;
                    update();
                });
            }

            inner.appendChild(widget);
        });

        container.appendChild(section);
    }
}
