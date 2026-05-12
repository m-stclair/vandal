import {clearRenderCache, resizeAndRedraw, setOriginalImage} from "./state.js";
import {gid} from "./utils/helpers.js";
import {hsv2Rgb} from "./utils/colorutils.js";
import {placeholderOption} from "./ui.js";


function uploadFromCanvas(ocv) {
    ocv.convertToBlob().then(blob => {
        const url = URL.createObjectURL(blob);
        const img = new Image(ocv.width, ocv.height);
        img.onload = () => {
            setOriginalImage(img);
            resizeAndRedraw();
            URL.revokeObjectURL(url);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            console.error("Failed to load image from generated canvas blob");
        };
        clearRenderCache();
        img.src = url;
    }).catch(error => {
        console.error("Failed to convert OffscreenCanvas to Blob:", error);
    });
}

export async function drawSquare(color='black') {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 2048, 2048);
    uploadFromCanvas(ocv);
}

export async function drawRGBSquares() {
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')

    const squareSize = ocv.width / 4;
    const gap = ocv.width / 15;
    const startX = gap;
    const posY = (ocv.height - squareSize) / 2;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    const colors = ['#ff0000', '#00ff00', '#0000ff'];
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
    const ocv = new OffscreenCanvas(2048, 2048)
    const ctx = ocv.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, ocv.width, 0);
    grad.addColorStop(0, 'black');
    grad.addColorStop(1, 'white');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ocv.width, ocv.height);
    uploadFromCanvas(ocv);
}

export async function drawHueWheel() {
    const ocv = new OffscreenCanvas(2048, 2048)
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
    const canvas = new OffscreenCanvas(2048, 2048)
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
    const canvas = new OffscreenCanvas(2048, 2048)
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

const TEST_PATTERN_SIZE = 2048;

function makeCanvas(background = "white") {
    const ocv = new OffscreenCanvas(TEST_PATTERN_SIZE, TEST_PATTERN_SIZE);
    const ctx = ocv.getContext("2d");

    if (background !== null) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, ocv.width, ocv.height);
    }

    return {ocv, ctx};
}

function seededRandom(seed = 1337) {
    return () => {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function drawCheckerboard(cells = 16) {
    const {ocv, ctx} = makeCanvas("white");
    const cell = ocv.width / cells;

    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "white" : "black";
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }

    uploadFromCanvas(ocv);
}

function drawFineCheckerboard(cells = 128) {
    const {ocv, ctx} = makeCanvas("white");
    const cell = ocv.width / cells;

    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "white" : "black";
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }

    uploadFromCanvas(ocv);
}

function drawColorBars() {
    const {ocv, ctx} = makeCanvas("black");

    const bars = [
        "#ffffff",
        "#ffff00",
        "#00ffff",
        "#00ff00",
        "#ff00ff",
        "#ff0000",
        "#0000ff",
        "#000000",
    ];

    const barWidth = ocv.width / bars.length;
    const topHeight = ocv.height * 0.75;

    bars.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i * barWidth, 0, barWidth, topHeight);
    });

    const steps = 16;
    const stepWidth = ocv.width / steps;

    for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(i * stepWidth, topHeight, stepWidth, ocv.height - topHeight);
    }

    uploadFromCanvas(ocv);
}

function drawGrayscaleSteps(steps = 32) {
    const {ocv, ctx} = makeCanvas("black");
    const stepWidth = ocv.width / steps;

    for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
        ctx.fillRect(i * stepWidth, 0, stepWidth, ocv.height);
    }

    uploadFromCanvas(ocv);
}

function drawRadialGradient() {
    const {ocv, ctx} = makeCanvas("black");

    const cx = ocv.width / 2;
    const cy = ocv.height / 2;
    const radius = Math.min(cx, cy);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, "white");
    grad.addColorStop(1, "black");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ocv.width, ocv.height);

    uploadFromCanvas(ocv);
}

function drawConcentricRings(rings = 64) {
    const {ocv, ctx} = makeCanvas("white");

    const cx = ocv.width / 2;
    const cy = ocv.height / 2;
    const maxRadius = Math.min(cx, cy);

    for (let i = rings; i >= 0; i--) {
        const radius = (i / rings) * maxRadius;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "black" : "white";
        ctx.fill();
    }

    uploadFromCanvas(ocv);
}

function drawZonePlate() {
    const {ocv, ctx} = makeCanvas(null);

    const imageData = ctx.createImageData(ocv.width, ocv.height);
    const data = imageData.data;

    const cx = ocv.width / 2;
    const cy = ocv.height / 2;
    const scale = 0.000085;

    for (let y = 0; y < ocv.height; y++) {
        for (let x = 0; x < ocv.width; x++) {
            const dx = x - cx;
            const dy = y - cy;

            const wave = Math.cos((dx * dx + dy * dy) * scale);
            const v = Math.round((wave * 0.5 + 0.5) * 255);

            const i = (y * ocv.width + x) * 4;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    uploadFromCanvas(ocv);
}

function drawSlantedEdge(angleDeg = 7) {
    const {ocv, ctx} = makeCanvas("white");

    ctx.translate(ocv.width / 2, ocv.height / 2);
    ctx.rotate(angleDeg * Math.PI / 180);

    ctx.fillStyle = "black";
    ctx.fillRect(-ocv.width, 0, ocv.width * 2, ocv.height);

    ctx.resetTransform();

    uploadFromCanvas(ocv);
}

function drawImpulseGrid(spacing = 128, dotSize = 3) {
    const {ocv, ctx} = makeCanvas("black");

    ctx.fillStyle = "white";

    for (let y = spacing / 2; y < ocv.height; y += spacing) {
        for (let x = spacing / 2; x < ocv.width; x += spacing) {
            ctx.fillRect(
                Math.round(x - dotSize / 2),
                Math.round(y - dotSize / 2),
                dotSize,
                dotSize
            );
        }
    }

    uploadFromCanvas(ocv);
}

function drawNoise(seed = 1337) {
    const {ocv, ctx} = makeCanvas(null);

    const rand = seededRandom(seed);
    const imageData = ctx.createImageData(ocv.width, ocv.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const v = Math.floor(rand() * 256);

        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
    uploadFromCanvas(ocv);
}

function drawRGBGradient() {
    const {ocv, ctx} = makeCanvas(null);

    const imageData = ctx.createImageData(ocv.width, ocv.height);
    const data = imageData.data;

    for (let y = 0; y < ocv.height; y++) {
        for (let x = 0; x < ocv.width; x++) {
            const r = x / (ocv.width - 1);
            const g = y / (ocv.height - 1);
            const b = 1 - ((r + g) / 2);

            const i = (y * ocv.width + x) * 4;
            data[i] = Math.round(r * 255);
            data[i + 1] = Math.round(g * 255);
            data[i + 2] = Math.round(b * 255);
            data[i + 3] = 255;
        }
    }

    ctx.putImageData(imageData, 0, 0);
    uploadFromCanvas(ocv);
}

function drawAlphaPattern() {
    const {ocv, ctx} = makeCanvas(null);

    const cells = 32;
    const cell = ocv.width / cells;

    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            const v = (x + y) % 2 === 0 ? 220 : 150;
            ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
            ctx.fillRect(x * cell, y * cell, cell, cell);
        }
    }

    const stripeCount = 16;
    const stripeWidth = ocv.width / stripeCount;

    for (let i = 0; i < stripeCount; i++) {
        const alpha = i / (stripeCount - 1);

        ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, ocv.height / 3);

        ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
        ctx.fillRect(i * stripeWidth, ocv.height / 3, stripeWidth, ocv.height / 3);

        ctx.fillStyle = `rgba(0, 0, 255, ${alpha})`;
        ctx.fillRect(i * stripeWidth, ocv.height * 2 / 3, stripeWidth, ocv.height / 3);
    }

    uploadFromCanvas(ocv);
}

const TEST_PATTERNS = [
    "black",
    "white",
    "rgb",
    "gray",
    "wheel",
    "spiral",
    "sinusoid",

    "checker",
    "fine-checker",
    "bars",
    "gray-steps",
    "radial",
    "rings",
    "zone-plate",
    "slanted-edge",
    "impulse-grid",
    "noise",
    "rgb-gradient",
    "alpha",
];

export async function drawPattern(pattern) {
    switch (pattern) {
        case "black":
            await drawSquare("black");
            return;
        case "white":
            await drawSquare("white");
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

        case "checker":
            await drawCheckerboard();
            return;
        case "fine-checker":
            await drawFineCheckerboard();
            return;
        case "bars":
            await drawColorBars();
            return;
        case "gray-steps":
            await drawGrayscaleSteps();
            return;
        case "radial":
            await drawRadialGradient();
            return;
        case "rings":
            await drawConcentricRings();
            return;
        case "zone-plate":
            await drawZonePlate();
            return;
        case "slanted-edge":
            await drawSlantedEdge();
            return;
        case "impulse-grid":
            await drawImpulseGrid();
            return;
        case "noise":
            await drawNoise();
            return;
        case "rgb-gradient":
            await drawRGBGradient();
            return;
        case "alpha":
            await drawAlphaPattern();
            return;
    }

    throw new Error(`unknown pattern ${pattern}`);
}

export function populateTestSelect() {
    const testSelect = gid("test-pattern-select");

    testSelect.appendChild(placeholderOption("-- pattern --"));

    TEST_PATTERNS.forEach(type => {
        const opt = document.createElement("option");
        opt.value = opt.text = type;
        testSelect.appendChild(opt);
    });

    testSelect.addEventListener("input", async () => {
        await drawPattern(testSelect.value);
    });
}

populateTestSelect();