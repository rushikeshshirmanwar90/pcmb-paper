/**
 * Quest — icon & splash asset generator
 *
 * Colours (from logo kit):
 *   Ink       #262624
 *   Terracotta #C6613F
 *   Cream     #FAF9F5
 *
 * Outputs (matching app.json paths):
 *   assets/images/icon.png                        1024×1024  iOS icon
 *   assets/images/android-icon-foreground.png     1024×1024  adaptive foreground (transparent bg)
 *   assets/images/android-icon-background.png     1024×1024  adaptive background (solid Ink)
 *   assets/images/android-icon-monochrome.png     1024×1024  monochrome (white mark on black)
 *   assets/images/splash-icon.png                  200×200   splash centre mark
 *   assets/images/favicon.png                       48×48    web favicon
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets/images');

// ─── Brand colours ───────────────────────────────────────────────
const INK        = '#262624';
const TERRA      = '#C6613F';
const CREAM      = '#FAF9F5';
const WHITE      = '#FFFFFF';

// ─── SVG logo mark builder ────────────────────────────────────────
// Canvas is `size × size`. The mark is a large mountain (right),
// a smaller mountain (left) and an orange dot above them.
// All coordinates are expressed as fractions of `size` so the mark
// scales to any output resolution.

function logoMarkSVG(size, { markFill = WHITE, dotFill = TERRA, bg = null } = {}) {
  const s = size;

  // Padding: 18 % each side so the mark sits inside the safe-zone
  const pad   = s * 0.18;
  const W     = s - pad * 2;   // usable width
  const H     = s - pad * 2;   // usable height
  const ox    = pad;            // origin x
  const oy    = pad;            // origin y

  // ── Large mountain (right, tall peak) ──
  // base spans right 55 % of usable width; peak at ~65 % x, top ~15 % y
  const lm = {
    bx1: ox + W * 0.38,
    bx2: ox + W * 1.00,
    by:  oy + H * 1.00,
    px:  ox + W * 0.68,
    py:  oy + H * 0.12,
  };

  // ── Small mountain (left, shorter) ──
  const sm = {
    bx1: ox + W * 0.00,
    bx2: ox + W * 0.58,
    by:  oy + H * 1.00,
    px:  ox + W * 0.28,
    py:  oy + H * 0.38,
  };

  // ── Orange dot ──
  // sits above the valley between the two peaks
  const dotR  = W * 0.072;
  const dotCx = ox + W * 0.50;
  const dotCy = oy + H * 0.08;

  const bgRect = bg
    ? `<rect width="${s}" height="${s}" fill="${bg}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${bgRect}
  <!-- small mountain (left) -->
  <polygon points="${sm.bx1},${sm.by} ${sm.px},${sm.py} ${sm.bx2},${sm.by}" fill="${markFill}"/>
  <!-- large mountain (right) -->
  <polygon points="${lm.bx1},${lm.by} ${lm.px},${lm.py} ${lm.bx2},${lm.by}" fill="${markFill}"/>
  <!-- terracotta dot -->
  <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="${dotFill}"/>
</svg>`;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function svgToPng(svgString, outPath, size) {
  await sharp(Buffer.from(svgString))
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`  ✓  ${path.relative(path.resolve(__dirname, '..'), outPath)}`);
}

// ─── Generate ─────────────────────────────────────────────────────

console.log('\nGenerating Quest brand assets…\n');

// 1. iOS icon  — Ink background, white mark, terracotta dot, 1024×1024
await svgToPng(
  logoMarkSVG(1024, { markFill: WHITE, dotFill: TERRA, bg: INK }),
  path.join(OUT, 'icon.png'),
  1024,
);

// 2. Android adaptive foreground — transparent bg, white mark, 1024×1024
//    The foreground image is composited over the separate background layer.
//    It must have a transparent background so the adaptive system can apply
//    its own masking (circle, squircle, etc.).
await svgToPng(
  logoMarkSVG(1024, { markFill: WHITE, dotFill: TERRA, bg: null }),
  path.join(OUT, 'android-icon-foreground.png'),
  1024,
);

// 3. Android adaptive background — solid Ink, 1024×1024
await sharp({
  create: { width: 1024, height: 1024, channels: 4,
            background: { r: 0x26, g: 0x26, b: 0x24, alpha: 1 } }
})
  .png()
  .toFile(path.join(OUT, 'android-icon-background.png'));
console.log('  ✓  assets/images/android-icon-background.png');

// 4. Android monochrome — white mark on pure black, 1024×1024
await svgToPng(
  logoMarkSVG(1024, { markFill: WHITE, dotFill: WHITE, bg: '#000000' }),
  path.join(OUT, 'android-icon-monochrome.png'),
  1024,
);

// 5. Splash icon — white mark + terracotta dot on transparent bg, 200×200
//    expo-splash-screen places this centred on the backgroundColor (#FAF9F5).
//    The mark itself should be on a transparent background so the splash
//    background colour shows through.
await svgToPng(
  logoMarkSVG(200, { markFill: INK, dotFill: TERRA, bg: null }),
  path.join(OUT, 'splash-icon.png'),
  200,
);

// 6. Favicon — Ink bg, white mark, 48×48
await svgToPng(
  logoMarkSVG(48, { markFill: WHITE, dotFill: TERRA, bg: INK }),
  path.join(OUT, 'favicon.png'),
  48,
);

console.log('\nAll assets written.\n');
