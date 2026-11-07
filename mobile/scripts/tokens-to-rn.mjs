#!/usr/bin/env node
/**
 * Generates src/theme/tokens.ts from the web's frontend/styles/tokens.json (§9),
 * so web and mobile share one source of truth. `--check` exits non-zero when the
 * committed file is stale (for CI, like `check:design`).
 *
 * Expected tokens.json shape (subset):
 * { "color": { "light": { "background": "#fff", ... }, "dark": { ... } },
 *   "radius": { "sm": 8, ... }, "spacing": { "md": 12, ... } }
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.TOKENS_JSON || join(root, '..', 'frontend', 'styles', 'tokens.json');
const target = join(root, 'src', 'theme', 'tokens.ts');
const check = process.argv.includes('--check');

if (!existsSync(source)) {
  console.log(`tokens.json not found at ${source} — keeping the committed Lumen baseline in src/theme/tokens.ts.`);
  process.exit(0);
}

const json = JSON.parse(readFileSync(source, 'utf8'));
const current = readFileSync(target, 'utf8');
// Merge web tokens over the baseline so mobile-only keys (diffAdd, codeBackground…) survive.
const baselineMatch = current.match(/export const tokens = ([\s\S]*?) as const;/);
if (!baselineMatch) throw new Error('Could not parse baseline tokens.ts');
// eslint-disable-next-line no-new-func
const baseline = Function(`return (${baselineMatch[1]})`)();

const merged = {
  ...baseline,
  color: {
    light: { ...baseline.color.light, ...(json.color?.light ?? {}) },
    dark: { ...baseline.color.dark, ...(json.color?.dark ?? {}) },
  },
  radius: { ...baseline.radius, ...(json.radius ?? {}) },
  spacing: { ...baseline.spacing, ...(json.spacing ?? {}) },
};

const header = current.slice(0, current.indexOf('export const tokens'));
const footer = current.slice(current.indexOf(' as const;') + ' as const;'.length);
const next = `${header}export const tokens = ${JSON.stringify(merged, null, 2).replace(/"([A-Za-z_][A-Za-z0-9_]*)":/g, '$1:').replace(/"/g, "'")} as const;${footer}`;

if (check) {
  if (next !== current) {
    console.error('src/theme/tokens.ts is stale. Run `npm run tokens`.');
    process.exit(1);
  }
  console.log('tokens.ts is up to date.');
} else {
  writeFileSync(target, next);
  console.log(`Wrote ${target}`);
}
