import {clearRenderCache, requestRender, resizeAndRedraw, setOriginalImage} from "./state.js";
import {gid} from "./utils/helpers.js";
import {hsv2Rgb} from "./utils/colorutils.js";
import {placeholderOption} from "./ui.js";


function uploadFromCanvas(ocv) {
    ocv.convertToBlob().then(blob => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            setOriginalImage(img);
            resizeAndRedraw();
        };
        clearRenderCache();
        img.src = url;
    }).catch(error => {
        console.error("Failed to convert OffscreenCanvas to Blob:", error);
    });
}

export async function drawBlackSquare() {
    const ocv = new OffscreenCanvas(1024, 1024)
    const ctx = ocv.getContext('2d')
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1024, 1024);
    uploadFromCanvas(ocv);
}

export async function drawRGBSquares() {
    const ocv = new OffscreenCanvas(1024, 1024)
    const ctx = ocv.getContext('2d')

    const squareSize = ocv.width / 4;
    const gap = ocv.width / 15;
    const startX = gap;
    const posY = (ocv.height - squareSize) / 2;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    const colors = ['red', 'green', 'blue'];
    colors.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(
            startX + i * (squareSize + gap),
            posY,
            squareSize,
            squareSize
        );
    });
    uploadFromCanvas(ocv);
}

export async function drawGrayscaleRamp() {
    const ocv = new OffscreenCanvas(1024, 1024)
    const ctx = ocv.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, ocv.width, 0);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'white');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    uploadFromCanvas(ocv);
}

export async function drawHueWheel() {
    const ocv = new OffscreenCanvas(1024, 1024)
    const context = ocv.getContext('2d');
    const radius = ocv.width / 2;
    const centerX = radius;
    const centerY = radius;

    context.clearRect(0, 0, ocv.width, ocv.height);

    const imageData = context.createImageData(ocv.width, ocv.height);
    const data = imageData.data;

    for (let y = 0; y < ocv.height; y++) {
        for (let x = 0; x < ocv.width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                const angle = Math.atan2(dy, dx) + Math.PI;
                const hue = angle / (2 * Math.PI);

                const [r, g, b] = hsv2Rgb(hue, 1, 1);

                const pixelIndex = (y * ocv.width + x) * 4;
                data[pixelIndex] = r * 255;
                data[pixelIndex + 1] = g * 255;
                data[pixelIndex + 2] = b * 255;
                data[pixelIndex + 3] = 255;
            }
        }
    }
    context.putImageData(imageData, 0, 0);
    uploadFromCanvas(ocv);
}

function drawSpiral(numLoops = 5, lineWidth = 2) {
    const canvas = new OffscreenCanvas(1024, 1024)
    const context = canvas.getContext('2d');

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(centerX, centerY);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.beginPath();
    context.moveTo(centerX, centerY);

    const step = 0.1;
    for (let t = 0; t < numLoops * Math.PI * 2; t += step) {
        const radius = maxRadius * t / (numLoops * Math.PI * 2);
        const x = centerX + radius * Math.cos(t);
        const y = centerY + radius * Math.sin(t);

        context.lineTo(x, y);
    }

    context.lineWidth = lineWidth;
    context.strokeStyle = 'black';
    context.stroke();
    uploadFromCanvas(canvas);
}

function drawSinusoid(amplitude = 512, frequency = 0.05) {
    const canvas = new OffscreenCanvas(1024, 1024)
    const context = canvas.getContext('2d');

    const midY = canvas.height / 2;

    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(0, midY);

    for (let x = 0; x < canvas.width; x++) {
        const y = midY + amplitude * Math.sin(frequency * x);
        context.lineTo(x, y);
    }

    context.strokeStyle = 'black';
    context.lineWidth = 2;
    context.stroke();
    uploadFromCanvas(canvas);
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
        case "wheel":
            await drawHueWheel();
            return;
        case "spiral":
            await drawSpiral(12, 4);
            return;
        case "sinusoid":
            await drawSinusoid();
            return;
    }
    throw new Error(`unknown pattern ${pattern}`)
}


export function populateTestSelect() {
    const testSelect = gid("test-pattern-select");
    testSelect.appendChild(placeholderOption("-- pattern --"));
    ["black", "rgb", "gray", "wheel", "spiral", "sinusoid"].forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        testSelect.appendChild(opt);
    });
    testSelect.addEventListener("input", async () => await drawPattern(testSelect.value))
}

populateTestSelect()