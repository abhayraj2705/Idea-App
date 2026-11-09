#!/usr/bin/env node
/**
 * Generates every icon/splash asset from one brand mark (MOBILE_APP_MASTER_PLAN.md §9):
 * iOS icon, Android adaptive (foreground/background) + monochrome (Android 13 themed icons),
 * splash (light/dark), notification icon (white silhouette, Android requirement) and favicon.
 *
 * Usage: npm run icons   (requires the `sharp` dev dependency)
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (f) => join(root, 'assets', f);
mkdirSync(join(root, 'assets'), { recursive: true });

const BG = '#0A0A0A';
const INK = '#0A0A0A';
const PAPER = '#FFFFFF';

/**
 * The brand mark (see src/components/brand/Logo.tsx): a square tile with an
 * up-right arrow, defined on a 32-unit grid and drawn here ×32 in a 1024 box.
 * `cut` punches the arrow out of the tile (transparent) for single-colour
 * assets: Android themed icon and the notification silhouette.
 */
function glyph({ tile = PAPER, arrow = INK, cut = false } = {}) {
  const d = 'M352 384H640V672M352 672L640 384';
  const stroke = 'stroke-width="64" stroke-linecap="butt" stroke-linejoin="miter" fill="none"';
  if (cut) {
    return `
      <defs><mask id="cut"><rect width="1024" height="1024" fill="#fff"/><path d="${d}" stroke="#000" ${stroke}/></mask></defs>
      <rect width="1024" height="1024" fill="${tile}" mask="url(#cut)"/>`;
  }
  return `<rect width="1024" height="1024" fill="${tile}"/><path d="${d}" stroke="${arrow}" ${stroke}/>`;
}

const svg = (body, { bg, size = 1024, scale = 1 } = {}) => {
  const t = (1024 - 1024 * scale) / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    ${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}
    <g transform="translate(${t} ${t}) scale(${scale})">${body}</g>
  </svg>`);
};

const png = (buf, file, size) => sharp(buf).resize(size, size).png().toFile(out(file));

await Promise.all([
  // iOS / store icon: opaque, full-bleed ink background, paper tile (iOS applies its own mask)
  png(svg(glyph(), { bg: BG, scale: 0.6 }), 'icon.png', 1024),
  // Android adaptive icon: tile fits inside the 66% safe circle (a square needs ≤ 0.467)
  png(svg(glyph(), { scale: 0.44 }), 'android-icon-foreground.png', 1024),
  png(svg('', { bg: BG }), 'android-icon-background.png', 1024),
  // Android 13 themed (monochrome) icon: arrow cut out of the tile
  png(svg(glyph({ tile: PAPER, cut: true }), { scale: 0.44 }), 'android-icon-monochrome.png', 1024),
  // Splash (imageWidth 180dp in app.config): tile at 0.4 → 72dp, same as the in-app BootScreen loader
  png(svg(glyph({ tile: INK, arrow: PAPER }), { scale: 0.4 }), 'splash-icon.png', 1024),
  png(svg(glyph({ tile: PAPER, arrow: INK }), { scale: 0.4 }), 'splash-icon-dark.png', 1024),
  // Notification small icon: white-only silhouette on transparent (Android requirement)
  png(svg(glyph({ tile: PAPER, cut: true }), { scale: 0.86 }), 'notification-icon.png', 96),
  // Web favicon
  png(svg(glyph(), { bg: BG, scale: 0.64 }), 'favicon.png', 48),
  // Store listing feature graphic (Google Play 1024x500)
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
      <rect width="1024" height="500" fill="${BG}"/>
      <g transform="translate(150 130) scale(0.234)">${glyph()}</g>
      <text x="470" y="235" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="96" font-weight="800" fill="#FAFAFA" letter-spacing="6">IDEA</text>
      <text x="473" y="295" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#A1A1AA">Describe an idea. Get a working app.</text>
    </svg>`),
  )
    .png()
    .toFile(join(root, 'store', 'feature-graphic.png'))
    .catch(() => mkdirSync(join(root, 'store'), { recursive: true })),
]);

console.log('Icons generated in assets/');
