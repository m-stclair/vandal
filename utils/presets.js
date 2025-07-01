// presets.js

const LOCAL_KEY = 'glitch_presets';

const builtInPresets = [
  {
    name: 'Scanline Glow',
    config: {/* full effect stack config object */}
  },
  {
    name: 'Melty TV',
    config: {/* another config */}
  }
];

function loadUserPresets() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(presets));
}

function addUserPreset(name, config) {
  const presets = loadUserPresets();
  presets.push({ name, config });
  saveUserPresets(presets);
}

function deleteUserPreset(name) {
  const presets = loadUserPresets().filter(p => p.name !== name);
  saveUserPresets(presets);
}

export const PresetStore = {
  getAll: () => [...builtInPresets, ...loadUserPresets()],
  add: addUserPreset,
  delete: deleteUserPreset
};