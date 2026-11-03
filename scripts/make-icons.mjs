// `npm run icons` (D-07, L-01, L-02): draws the five app icons into public/icons/ with the
// Playwright Chromium that is already a dev dependency. The art is own vector work made only of
// marks that stand on the panel: the DA50RG type name, the GO-AROUND mark, the bezel grey and the
// glass black (colours as in src/ui/panel/PanelShell.tsx and src/ui/stage.css). No logo, swoosh,
// bird or wordmark shape, no maker name. The PNGs are committed; CI never runs this script.
// Input: the B612 bold face of @fontsource (inlined into the throwaway page below, not into src/).
// Output: five files in public/icons/. Nothing else is read or written.
/* global document, Image */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(repo, 'public/icons');
const fontFile = resolve(repo, 'node_modules/@fontsource/b612/files/b612-latin-700-normal.woff2');

const GROUND = '#0b0d10'; // glass black, the stage background and the theme colour
const BEZEL = '#8a9099'; // the GO-AROUND mark's grey and the bezel rim
const LEGEND = '#c9d0d8'; // the DA50RG nameplate text
const RIM = '#2d3138'; // the quiet inner rim of a display bezel

/**
 * The five icons. `bleed`: the ground fills the whole square (apple and maskable); otherwise it is
 * a rounded square on a transparent background. `half`: half width and half height of the bezel
 * outline as fractions of the side. `safe`: the art must lie inside the circle of this radius
 * fraction (maskable only). `sub`: draw the GO-AROUND line.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, bleed: false, half: [0.4, 0.31], text: 'DA50RG', sub: true },
  { file: 'icon-512.png', size: 512, bleed: false, half: [0.4, 0.31], text: 'DA50RG', sub: true },
  {
    file: 'icon-512-maskable.png',
    size: 512,
    bleed: true,
    half: [0.3, 0.235],
    text: 'DA50RG',
    sub: true,
    safe: 0.4,
  },
  {
    file: 'apple-touch-icon.png',
    size: 180,
    bleed: true,
    half: [0.36, 0.28],
    text: 'DA50RG',
    sub: true,
  },
  { file: 'favicon-32.png', size: 32, bleed: false, half: [0.46, 0.38], text: 'DA50', sub: false },
];

/** The page for one icon. The text is fitted to a width by measuring it, not by guessing. */
function pageFor(icon, fontBase64) {
  const { size, half, bleed, text, sub } = icon;
  const cx = size / 2;
  const cy = size / 2;
  const w = half[0] * size;
  const h = half[1] * size;
  const stroke = Math.max(1.2, size * 0.022);
  const rim = Math.max(0.8, size * 0.008);
  const inset = stroke * 1.6;
  const ground = bleed
    ? `<rect width="${size}" height="${size}" fill="${GROUND}"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${GROUND}"/>`;
  // Text widths as fractions of the bezel width; the maths below sets the font size from them.
  const mainY = sub ? cy - h * 0.1 : cy;
  const subY = cy + h * 0.52;
  return `<!doctype html><html><head><style>
@font-face{font-family:'B612 Icon';font-weight:700;src:url(data:font/woff2;base64,${fontBase64}) format('woff2');}
html,body{margin:0;background:transparent;}
svg{display:block;}
text{font-family:'B612 Icon';font-weight:700;}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${ground}
<rect x="${cx - w}" y="${cy - h}" width="${2 * w}" height="${2 * h}" rx="${size * 0.05}" fill="#0c0d0f" stroke="${BEZEL}" stroke-width="${stroke}"/>
<rect x="${cx - w + inset}" y="${cy - h + inset}" width="${2 * w - 2 * inset}" height="${2 * h - 2 * inset}" rx="${size * 0.03}" fill="none" stroke="${RIM}" stroke-width="${rim}"/>
<text id="main" x="${cx}" y="${mainY}" text-anchor="middle" dominant-baseline="central" font-size="100" fill="${LEGEND}">${text}</text>
${
  sub
    ? `<text id="sub" x="${cx}" y="${subY}" text-anchor="middle" dominant-baseline="central" font-size="100" letter-spacing="0.2em" fill="${BEZEL}">GO-AROUND</text>`
    : ''
}
</svg></body></html>`;
}

/** The wanted text widths of an icon in pixels (fractions of the bezel width). */
function widthsFor(icon) {
  const w = icon.half[0] * icon.size;
  return { main: 2 * w * (icon.sub ? 0.76 : 0.74), sub: 2 * w * 0.62 };
}

/** Sets each text's font size so that its measured length equals the wanted width. */
async function fitText(page, widths) {
  await page.evaluate(async (fit) => {
    await document.fonts.load("700 100px 'B612 Icon'");
    await document.fonts.ready;
    for (const id of ['main', 'sub']) {
      const node = document.getElementById(id);
      if (node === null) continue;
      const length = node.getComputedTextLength();
      node.setAttribute('font-size', String(100 * (fit[id] / length)));
    }
  }, widths);
}

/** Counts pixels outside the circle that are not the ground colour (maskable gate). */
async function strayPixels(page, png, safe) {
  return page.evaluate(
    async ({ base64, radius, ground }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      const want = [1, 3, 5].map((i) => parseInt(ground.slice(i, i + 2), 16));
      let stray = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const dx = x + 0.5 - width / 2;
          const dy = y + 0.5 - height / 2;
          if (dx * dx + dy * dy <= radius * width * (radius * width)) continue;
          const at = (y * width + x) * 4;
          const same = data[at] === want[0] && data[at + 1] === want[1] && data[at + 2] === want[2];
          if (!same || data[at + 3] !== 255) stray += 1;
        }
      }
      return stray;
    },
    { base64: png.toString('base64'), radius: safe, ground: GROUND },
  );
}

const fontBase64 = (await readFile(fontFile)).toString('base64');
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
let failed = false;
try {
  for (const icon of ICONS) {
    const page = await browser.newPage({
      viewport: { width: icon.size, height: icon.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(pageFor(icon, fontBase64));
    await fitText(page, widthsFor(icon));
    const png = await page.screenshot({
      omitBackground: true,
      clip: { x: 0, y: 0, width: icon.size, height: icon.size },
    });
    if (icon.safe !== undefined) {
      const stray = await strayPixels(page, png, icon.safe);
      if (stray > 0) {
        process.stderr.write(`${icon.file}: ${stray} pixels outside the safe circle\n`);
        failed = true;
      }
    }
    await writeFile(resolve(outDir, icon.file), png);
    process.stdout.write(`${icon.file} ${icon.size}x${icon.size} ${png.length} bytes\n`);
    await page.close();
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
