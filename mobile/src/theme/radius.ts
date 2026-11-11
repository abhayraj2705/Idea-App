/**
 * Corner radii by role, so screens don't each pick their own numbers.
 * (Kept out of tokens.ts, which scripts/tokens-to-rn.mjs regenerates.)
 */
export const radius = {
  /** Small badges, thumbnails, code blocks. */
  sm: 8,
  /** Inputs, list cards, selectable option cards, icon tiles. */
  control: 12,
  /** Large surfaces: hero panels, sheets. */
  lg: 16,
} as const;
