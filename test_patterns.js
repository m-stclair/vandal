import {requestRender, resizeAndRedraw, setOriginalImage} from "./state.js";
import {gid} from "./utils/helpers.js";
import {hsv2Rgb} from "./utils/colorutils.js";
import {canvas, defaultCtx} from "./ui.js";

// async function drawBlackSquare(imgElement) {
//     canvas.width = 1024;
//     canvas.height = 1024;
//
//     defaultCtx.fillStyle = 'black';
//     defaultCtx.fillRect(0, 0, canvas.width, canvas.height);
//
//     imgElement.src = canvas.toDataURL();
//     setOriginalImage(imgElement);
// }

export async function drawBlackSquare() {
    const imgElement = document.createElement('img');
    canvas.width = 1024;
    canvas.height = 1024;
    defaultCtx.fillStyle = 'black';
    defaultCtx.fillRect(0, 0, canvas.width, canvas.height);
    imgElement.src = canvas.toDataURL();
    setOriginalImage(imgElement);
    // resizeAndRedraw();
}

export async function drawRGBSquares() {
    const canvas = gid("glitchCanvas")
    const imgElement = document.createElement('img');
    canvas.width = 1024;
    canvas.height = 1024;
  if (canvas.width <= 0 || canvas.height <= 0) {
    console.error("Invalid canvas size, unable to proceed with drawing.")
    return
  }
    const squareSize = canvas.width / 4;
    const gap = canvas.width / 15;
    const startX = gap;                    // left margin
    const posY = (canvas.height - squareSize) / 2;

    defaultCtx.fillStyle = 'black';
    defaultCtx.fillRect(0, 0, canvas.width, canvas.height);
    const colors = ['red', 'green', 'blue'];
    colors.forEach((col, i) => {
        defaultCtx.fillStyle = col;
        defaultCtx.fillRect(
            startX + i * (squareSize + gap),
            posY,
            squareSize,
            squareSize
        );
    });
    imgElement.src = canvas.toDataURL();
    setOriginalImage(imgElement);
    // resizeAndRedraw();
}

export async function drawGrayscaleRamp() {
    const canvas = gid("glitchCanvas")
    canvas.width = 1024;
    canvas.height = 1024;

    const imgElement = document.createElement('img');
    const grad = defaultCtx.createLinearGradient(0, 0, canvas.width, 0);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'white');
    defaultCtx.fillStyle = grad;
    defaultCtx.fillRect(0, 0, canvas.width, canvas.height);
    imgElement.src = canvas.toDataURL();
    setOriginalImage(imgElement);
    // resizeAndRedraw();
}

export async function drawHueCycle() {
        const canvas = gid("glitchCanvas")

    const img = document.createElement('img');

    const w = 1024, h = 1024;
    const data = img.data;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(cx, cy);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.hypot(dx, dy);
            const idx = 4 * (y * w + x);

            if (d > radius) {
                // outside circle → transparent / black
                data[idx + 0] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 255;
            } else {
                let ang = Math.atan2(dy, dx);         // -PI … +PI
                let hue = (ang / (2 * Math.PI) + 0.5); // 0 … 1
                const [r, g, b] = hsv2Rgb(hue, 1, 1);
                data[idx + 0] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
    }
    defaultCtx.putImageData(img, 0, 0);
    img.src = canvas.toDataURL();
    setOriginalImage(img);
}

async function drawPattern(pattern) {
    switch (pattern) {
        case "black":
            await drawBlackSquare();
            return;
        case "rgb":
            await drawRGBSquares();
            return;
        case "gray":
            await drawGrayscaleRamp();
            return;
        // case "wheel":
        //     await drawHueCycle();
        //     return;
    }
    throw new  Error(`unknown pattern ${pattern}`)
}

function makeTestSelect() {
    const testSelect = document.createElement("select");
    ["black", "rgb", "gray"].forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        testSelect.appendChild(opt);
    });
    gid("topBar").appendChild(testSelect)
    testSelect.addEventListener("input", async () => await drawPattern(testSelect.value))
}

makeTestSelect();