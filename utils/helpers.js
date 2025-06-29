/**
* @param {string} id
* @returns {HTMLElement}
*/
const gid = (id) => document.getElementById(id)

/**
 * @param {string} name
 * @returns {NodeListOf<HTMLElement>}
 */
const gen = (name) => document.getElementsByName(name)

/**
 * @param {*} obj
 * @returns {Array|*[]}
 */
const listify = function(obj) {
    if (obj instanceof Array) {
        return obj
    }
    return [obj]
}

/**
 * Create a stable string hash from an object by sorting keys.
 * @param {Record<string, any>} obj - Config subset or full config
 * @returns {string} hash key
 */
export function makeConfigHash(obj) {
    if (typeof obj !== 'object' || obj === null) return String(obj);

    const stable = (x) => {
        if (Array.isArray(x)) {
            return `[${x.map(stable).join(',')}]`;
        } else if (typeof x === 'object' && x !== null) {
            return `{${Object.keys(x).sort().map(k => `${k}:${stable(x[k])}`).join(',')}}`;
        } else {
            return JSON.stringify(x);
        }
    };

    return stable(obj);
}

export function imageDataHash(imageData, sampleStride = 16) {
    const data = imageData.data;
    let hash = 0;

    for (let i = 0; i < data.length; i += 4 * sampleStride) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Simple bit mash
        hash ^= ((r << 24) | (g << 16) | (b << 8) | a);
        hash = (hash >>> 1) | (hash << 31); // Rotate
        hash = hash >>> 0; // Force unsigned
    }

    return hash.toString(16).padStart(8, '0');
}

const DOWNSAMPLE_LIMIT = 128;

export async function downsampleImageData(imageData, maxSize = DOWNSAMPLE_LIMIT) {
    const scale = Math.min(
        maxSize / imageData.width,
        maxSize / imageData.height,
        1 // don't upscale
    );
    const w = Math.floor(imageData.width * scale);
    const h = Math.floor(imageData.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const bitmap = await createImageBitmap(imageData);
    ctx.drawImage(bitmap, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}

export function showImageData(imageData) {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.style.border = "2px solid red"; // for visibility
    canvas.style.margin = "4px";
    canvas.style.imageRendering = "pixelated"; // sharp zoom
    canvas.style.width = "512px"; // optional: upscale for visual clarity

    const ctx = canvas.getContext("2d");
    ctx.putImageData(imageData, 0, 0);
    gid("debug").appendChild(canvas); // or some debug div
}


function fallbackUUIDv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8); // ensure `y` is in [8, 9, A, B]
    return v.toString(16);
  });
}

export function uuidv4() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Per RFC4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return [...bytes].map((b, i) => {
      const hex = b.toString(16).padStart(2, '0');
      return [4, 6, 8, 10].includes(i) ? '-' + hex : hex;
    }).join('');
  } else {
    return fallbackUUIDv4();
  }
}


export {gid, gen}
