import { create as createQr } from "qrcode";

const INK: Rgb = [20, 20, 20];
const BRAND = "#ed6900";

type Rgb = [number, number, number];

/** Центры выравнивающих меток. Угол (6, …) совпадает с поисковым узором и пропускается. */
const ALIGNMENT: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function setPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  rgb: Rgb,
) {
  if (x < 0 || y < 0 || x >= width || y >= data.length / 4 / width) {
    return;
  }
  const i = (y * width + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = 255;
}

function fillRoundRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  rgb: Rgb,
) {
  const r = Math.min(radius, w / 2, h / 2);
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width - 1, Math.ceil(x + w));
  const y1 = Math.min(height - 1, Math.ceil(y + h));
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const sx = px + 0.5;
      const sy = py + 0.5;
      const cx = Math.min(Math.max(sx, x + r), x + w - r);
      const cy = Math.min(Math.max(sy, y + r), y + h - r);
      const dx = sx - cx;
      const dy = sy - cy;
      if (dx * dx + dy * dy <= r * r) {
        setPixel(data, width, px, py, rgb);
      }
    }
  }
}

function fillRect(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: Rgb,
) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(width, Math.ceil(x + w));
  const y1 = Math.min(data.length / 4 / width, Math.ceil(y + h));
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      setPixel(data, width, px, py, rgb);
    }
  }
}

function fillCircle(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  rgb: Rgb,
) {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) {
        setPixel(data, width, px, py, rgb);
      }
    }
  }
}

function moduleOrigin(index: number, quiet: number, modulePx: number): number {
  return (quiet + index) * modulePx;
}

function drawFinder(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
  modulePx: number,
) {
  const size = modulePx * 7;
  fillRoundRect(data, width, height, originX, originY, size, size, modulePx * 1.35, INK);
  fillRoundRect(
    data,
    width,
    height,
    originX + modulePx,
    originY + modulePx,
    modulePx * 5,
    modulePx * 5,
    modulePx * 0.9,
    [255, 255, 255],
  );
  fillRoundRect(
    data,
    width,
    height,
    originX + modulePx * 2,
    originY + modulePx * 2,
    modulePx * 3,
    modulePx * 3,
    modulePx * 0.7,
    INK,
  );
}

function drawAlignment(
  data: Uint8ClampedArray,
  width: number,
  centerRow: number,
  centerCol: number,
  quiet: number,
  modulePx: number,
) {
  const x = moduleOrigin(centerCol - 2, quiet, modulePx);
  const y = moduleOrigin(centerRow - 2, quiet, modulePx);
  fillRect(data, width, x, y, modulePx * 5, modulePx * 5, INK);
  fillRect(
    data,
    width,
    x + modulePx,
    y + modulePx,
    modulePx * 3,
    modulePx * 3,
    [255, 255, 255],
  );
  fillRect(
    data,
    width,
    x + modulePx * 2,
    y + modulePx * 2,
    modulePx,
    modulePx,
    INK,
  );
}

function inFinder(row: number, col: number, count: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= count - 7) ||
    (row >= count - 7 && col < 7)
  );
}

function alignmentCenters(version: number, count: number): Array<[number, number]> {
  const spots = ALIGNMENT[version - 1] ?? [];
  const centers: Array<[number, number]> = [];
  for (const row of spots) {
    for (const col of spots) {
      const hitsFinder =
        (row <= 8 && col <= 8) ||
        (row <= 8 && col >= count - 9) ||
        (row >= count - 9 && col <= 8);
      if (!hitsFinder) {
        centers.push([row, col]);
      }
    }
  }
  return centers;
}

function inAlignment(
  row: number,
  col: number,
  centers: Array<[number, number]>,
): boolean {
  return centers.some(
    ([centerRow, centerCol]) =>
      Math.abs(row - centerRow) <= 2 && Math.abs(col - centerCol) <= 2,
  );
}

/** Растр QR: чёрные поисковые метки и плотные точки. Белый круг в центре — место знака. */
export function rasterSiteQr(
  url: string,
  modulePx = 20,
): { width: number; height: number; data: Uint8ClampedArray; markDiameter: number } {
  const qr = createQr(url, { errorCorrectionLevel: "H" });
  const count = qr.modules.size;
  const quiet = 4;
  const width = (count + quiet * 2) * modulePx;
  const height = width;
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);

  const finders: Array<[number, number]> = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  for (const [row, col] of finders) {
    drawFinder(
      data,
      width,
      height,
      moduleOrigin(col, quiet, modulePx),
      moduleOrigin(row, quiet, modulePx),
      modulePx,
    );
  }

  const centers = alignmentCenters(qr.version, count);
  for (const [row, col] of centers) {
    drawAlignment(data, width, row, col, quiet, modulePx);
  }

  const dotRadius = modulePx * 0.46;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col) !== 1) {
        continue;
      }
      if (inFinder(row, col, count) || inAlignment(row, col, centers)) {
        continue;
      }
      fillCircle(
        data,
        width,
        height,
        moduleOrigin(col, quiet, modulePx) + modulePx / 2,
        moduleOrigin(row, quiet, modulePx) + modulePx / 2,
        dotRadius,
        INK,
      );
    }
  }

  const markDiameter = count * modulePx * 0.28;
  fillCircle(data, width, height, width / 2, height / 2, markDiameter / 2, [
    255, 255, 255,
  ]);

  return { width, height, data, markDiameter };
}

function drawBrandMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  diameter: number,
) {
  const font = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
  ctx.save();
  const ring = Math.max(6, diameter * 0.045);
  ctx.beginPath();
  ctx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, diameter / 2 - ring / 2 - 1, 0, Math.PI * 2);
  ctx.lineWidth = ring;
  ctx.strokeStyle = BRAND;
  ctx.stroke();

  ctx.fillStyle = BRAND;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(diameter * 0.58)}px ${font}`;
  ctx.fillText("S", cx, cy + diameter * 0.03);
  ctx.restore();
}

/** QR со ссылкой на сайт и оранжевой S в центре. */
export async function renderSiteQrPng(url: string): Promise<string> {
  await document.fonts.ready;
  const { width, height, data, markDiameter } = rasterSiteQr(url);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas");
  }
  const image = ctx.createImageData(width, height);
  image.data.set(data);
  ctx.putImageData(image, 0, 0);
  drawBrandMark(ctx, width / 2, height / 2, markDiameter);
  return canvas.toDataURL("image/png");
}
