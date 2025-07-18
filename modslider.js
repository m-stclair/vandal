function dualZoneRemap(x, pivot = 0.25, expLow = 2.5, expHigh = 1.0) {
  if (x < pivot) {
    return Math.pow(x / pivot, expLow) * pivot;
  } else {
    return pivot + (1 - pivot) * Math.pow((x - pivot) / (1 - pivot), expHigh);
  }
}


export function createDualResponseSlider({
  container,              // DOM node to append to
  label = "Param",
  min = 0, max = 1,       // Output range (not slider's 0–1)
  pivot = 0.25,
  expLow = 2.5,
  expHigh = 1.0,
  initial = 0.1,
  units = "",             // e.g. "Hz" or "s"
  format = v => v.toFixed(3),  // formatting function
  onChange = v => {}      // callback with mapped value
}) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "0.5em";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = 1;
  slider.step = 0.001;
  slider.value = 0.01;

  const valueDisplay = document.createElement("span");

  const update = (e) => {
    const raw = parseFloat(slider.value);
    const mapped = dualZoneRemap(raw, pivot, expLow, expHigh);
    const scaled = min + mapped * (max - min);
    valueDisplay.textContent = format(scaled) + units;
    onChange(e, scaled);
  };

  slider.addEventListener("input", update);
  slider.value = initial; // this sets position, but update() maps it
  update();

  wrapper.appendChild(labelEl);
  wrapper.appendChild(slider);
  wrapper.appendChild(valueDisplay);
  container.appendChild(wrapper);

  return {
    setValue: v => {
      // inverse map is messy; this sets raw input directly
      slider.value = v;
      update();
    },
    getValue: () => parseFloat(slider.value)
  };
}
