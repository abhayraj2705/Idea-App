import { MD3DarkTheme, MD3LightTheme, configureFonts, useTheme, type MD3Theme } from 'react-native-paper';

import { font } from './fonts';
import { tokens, type ColorScheme, type ColorTokens } from './tokens';

export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & {
    success: string;
    successContainer: string;
    warning: string;
    warningContainer: string;
    info: string;
    infoContainer: string;
    textMuted: string;
    textSubtle: string;
    border: string;
    codeBackground: string;
    diffAdd: string;
    diffRemove: string;
  };
  tokens: typeof tokens;
  scheme: ColorScheme;
};

/**
 * MD3 type scale on the brand family. Sizes follow MD3; weight comes from the
 * family (fontWeight stays '400' so Android doesn't synthesise extra bold).
 * Large display/headline styles get slightly tighter tracking for a crisper look.
 */
type Variant = keyof typeof MD3LightTheme.fonts;
const familyFor: Record<string, string> = {
  display: font.extrabold,
  headline: font.bold,
  title: font.semibold,
  label: font.semibold,
  body: font.regular,
};
const tracking: Partial<Record<Variant, number>> = {
  displayLarge: -1,
  displayMedium: -0.75,
  displaySmall: -0.5,
  // Display sizes only. Android mis-measures wrapped lines for custom fonts with
  // negative letterSpacing and clips the last line (seen on titles at 320dp), so
  // anything that can wrap (headline/title/body) keeps the default tracking.
};
const fonts = configureFonts({
  config: Object.fromEntries(
    (Object.keys(MD3LightTheme.fonts) as Variant[]).map((v) => {
        const base = MD3LightTheme.fonts[v] as { letterSpacing: number };
        const family = familyFor[v.replace(/(Large|Medium|Small)$/, '')] ?? font.regular;
      return [v, { fontFamily: family, fontWeight: '400' as const, letterSpacing: tracking[v] ?? base.letterSpacing }];
    }),
  ),
});

function build(scheme: ColorScheme): AppTheme {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const c: ColorTokens = tokens.color[scheme];
  return {
    ...base,
    roundness: 3, // Paper multiplies this; gives 12px cards
    fonts,
    colors: {
      ...base.colors,
      primary: c.accent,
      onPrimary: c.onAccent,
      primaryContainer: c.accentContainer,
      onPrimaryContainer: c.onAccentContainer,
      secondary: c.text,
      onSecondary: c.background,
      secondaryContainer: c.surfaceVariant,
      onSecondaryContainer: c.text,
      tertiary: c.info,
      onTertiary: c.onAccent,
      tertiaryContainer: c.infoContainer,
      onTertiaryContainer: c.text,
      background: c.background,
      onBackground: c.text,
      surface: c.surface,
      onSurface: c.text,
      surfaceVariant: c.surfaceVariant,
      onSurfaceVariant: c.textMuted,
      surfaceDisabled: base.colors.surfaceDisabled,
      outline: c.border,
      outlineVariant: c.border,
      error: c.error,
      onError: c.onError,
      errorContainer: c.errorContainer,
      onErrorContainer: c.onErrorContainer,
      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseText,
      inversePrimary: c.accent,
      scrim: c.scrim,
      elevation: {
        level0: 'transparent',
        level1: c.surfaceRaised,
        level2: c.surfaceVariant,
        level3: c.surfaceVariant,
        level4: c.surfaceVariant,
        level5: c.surfaceVariant,
      },
      success: c.success,
      successContainer: c.successContainer,
      warning: c.warning,
      warningContainer: c.warningContainer,
      info: c.info,
      infoContainer: c.infoContainer,
      textMuted: c.textMuted,
      textSubtle: c.textSubtle,
      border: c.border,
      codeBackground: c.codeBackground,
      diffAdd: c.diffAdd,
      diffRemove: c.diffRemove,
    },
    tokens,
    scheme,
  };
}

export const lightTheme = build('light');
export const darkTheme = build('dark');

export const useAppTheme = () => useTheme<AppTheme>();
