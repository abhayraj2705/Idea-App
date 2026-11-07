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
const ORANGE_A = '#FDBA74';
const ORANGE_B = '#EA580C';

/** The glyph: a lightbulb with a spark inside and three rays, drawn in a 1024 box. */
function glyph({ fill = 'url(#g)', spark = '#FFFFFF', rays = ORANGE_A, mono = false } = {}) {
  const f = mono ? '#FFFFFF' : fill;
  const r = mono ? '#FFFFFF' : rays;
  // In monochrome the spark is cut out of the bulb (transparent), so the silhouette stays readable.
  const sparkPath = 'M512 300 L540 412 L652 440 L540 468 L512 580 L484 468 L372 440 L484 412 Z';
  return `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ORANGE_A}"/>
        <stop offset="1" stop-color="${ORANGE_B}"/>
      </linearGradient>
      <mask id="cut">
        <rect width="1024" height="1024" fill="#fff"/>
        <path d="${sparkPath}" fill="#000"/>
      </mask>
    </defs>
    <g stroke-linecap="round">
      <line x1="512" y1="132" x2="512" y2="186" stroke="${r}" stroke-width="40"/>
      <line x1="300" y1="216" x2="336" y2="254" stroke="${r}" stroke-width="40"/>
      <line x1="724" y1="216" x2="688" y2="254" stroke="${r}" stroke-width="40"/>
    </g>
    <g ${mono ? 'mask="url(#cut)"' : ''}>
      <path fill="${f}" d="M512 228c-120 0-214 92-214 210 0 76 38 130 82 172 26 25 40 52 40 82v22h184v-22c0-30 14-57 40-82 44-42 82-96 82-172 0-118-94-210-214-210z"/>
      <rect x="420" y="742" width="184" height="40" rx="20" fill="${f}"/>
      <rect x="446" y="800" width="132" height="40" rx="20" fill="${f}"/>
    </g>
    ${mono ? '' : `<path d="${sparkPath}" fill="${spark}"/>`}
  `;
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
  // iOS / store icon: opaque, full-bleed background (iOS applies its own mask)
  png(svg(glyph(), { bg: BG, scale: 0.86 }), 'icon.png', 1024),
  // Android adaptive icon: glyph inside the 66% safe zone, solid background layer
  png(svg(glyph(), { scale: 0.62 }), 'android-icon-foreground.png', 1024),
  png(svg('', { bg: BG }), 'android-icon-background.png', 1024),
  // Android 13 themed (monochrome) icon
  png(svg(glyph({ mono: true }), { scale: 0.62 }), 'android-icon-monochrome.png', 1024),
  // Splash: transparent glyph on the configured light/dark background
  png(svg(glyph({ spark: '#FFFFFF' }), { scale: 0.9 }), 'splash-icon.png', 1024),
  png(svg(glyph({ spark: '#0A0A0A' }), { scale: 0.9 }), 'splash-icon-dark.png', 1024),
  // Notification small icon: white-only silhouette on transparent (Android requirement)
  png(svg(glyph({ mono: true }), { scale: 0.92 }), 'notification-icon.png', 96),
  // Web favicon
  png(svg(glyph(), { bg: BG, scale: 0.86 }), 'favicon.png', 48),
  // Store listing feature graphic (Google Play 1024x500)
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
      <rect width="1024" height="500" fill="${BG}"/>
      <g transform="translate(40 40) scale(0.41)">${glyph()}</g>
      <text x="470" y="235" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="96" font-weight="800" fill="#FAFAFA" letter-spacing="6">IDEA</text>
      <text x="473" y="295" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" fill="#A1A1AA">Describe an idea. Get a working app.</text>
    </svg>`),
  )
    .png()
    .toFile(join(root, 'store', 'feature-graphic.png'))
    .catch(() => mkdirSync(join(root, 'store'), { recursive: true })),
]);

console.log('Icons generated in assets/');
