import Svg, { Path, Rect } from 'react-native-svg';

import { useAppTheme } from '@/theme/theme';

/**
 * IDEA brand mark: a solid square tile with an up-right "launch" arrow.
 *
 * Geometry is traced from the master artwork on a 32-unit grid:
 *  - tile: full 32×32, square corners
 *  - arrow: 2-unit stroke, mitred corner, butt ends
 *    head = top bar (11,12)→(20,12) + right bar (20,12)→(20,21)
 *    shaft = (11,21)→(20,12)
 * scripts/generate-icons.mjs uses the same numbers (×32) for the app icons, so
 * the in-app mark and the launcher icon stay pixel-identical.
 */
export const LOGO_VIEWBOX = 32;
export const LOGO_ARROW_PATH = 'M11 12H20V21M11 21L20 12';
export const LOGO_STROKE = 2;

export type LogoColors = {
  /** Tile fill. Defaults to the theme's text colour (black in light, white in dark). */
  tile?: string;
  /** Arrow colour. Defaults to the theme background so it reads as a cut-out. */
  glyph?: string;
};

export function useLogoColors({ tile, glyph }: LogoColors = {}) {
  const theme = useAppTheme();
  return { tile: tile ?? theme.colors.onSurface, glyph: glyph ?? theme.colors.background };
}

/** Arrow glyph alone (transparent background). Used by the loader. */
export function LogoArrow({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}>
      <Path
        d={LOGO_ARROW_PATH}
        stroke={color}
        strokeWidth={LOGO_STROKE}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />
    </Svg>
  );
}

/**
 * The brand arrow cropped to its own bounds, sized like an icon-font glyph.
 * Signature matches Paper's icon-source function, so it can be passed straight
 * to `<Button icon={BrandArrowIcon}>` or `<List.Icon icon={BrandArrowIcon}>`.
 */
export function BrandArrowIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="8.5 9.5 15 14">
      <Path d={LOGO_ARROW_PATH} stroke={color} strokeWidth={LOGO_STROKE} strokeLinecap="butt" strokeLinejoin="miter" fill="none" />
    </Svg>
  );
}

type MarkProps = LogoColors & {
  size?: number;
  /** Corner radius as a fraction of size. The master artwork is square (0). */
  rounded?: number;
  accessibilityLabel?: string;
};

/** Static brand mark. */
export function LogoMark({ size = 48, rounded = 0, accessibilityLabel = 'IDEA logo', ...colors }: MarkProps) {
  const c = useLogoColors(colors);
  const r = rounded * LOGO_VIEWBOX;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Rect width={LOGO_VIEWBOX} height={LOGO_VIEWBOX} rx={r} ry={r} fill={c.tile} />
      <Path
        d={LOGO_ARROW_PATH}
        stroke={c.glyph}
        strokeWidth={LOGO_STROKE}
        strokeLinecap="butt"
        strokeLinejoin="miter"
        fill="none"
      />
    </Svg>
  );
}
