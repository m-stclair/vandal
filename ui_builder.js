import widgets from "./widgets.js"

export function buildUI(instance, container, config, update, layout) {
  container.innerHTML = ''; // Clear old UI

  layout.forEach(item => {
    const { type, key, label } = item;
    const value = config[key];
    let widget;

    switch (type.toLowerCase()) {
      case 'range':
        widget = widgets.Range(
            { key, label, value, min: item.min, max: item.max, step: item.step }
        );
        break;
      case 'select':
        widget = widgets.Select({ key, label, value, options: item.options });
        break;
      case 'checkbox':
        widget = widgets.Checkbox({ key, label, value });
        break;
      case 'referenceimage':
        widget = widgets.ReferenceImage(key, label, instance, update);
        break;  // skip default eventListener
      default:
        console.warn(`Unknown widget type: ${type}`);
        return;
    }
    if (type.toLowerCase() !== 'referenceImage') {
      widget.addEventListener('input', () => {
        config[key] = widget.value;
        update();
      });
    }

    container.appendChild(widget);
  });
}