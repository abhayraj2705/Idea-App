import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, configureFonts, useTheme, type MD3Theme } from 'react-native-paper';

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

function build(scheme: ColorScheme): AppTheme {
  const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const c: ColorTokens = tokens.color[scheme];
  return {
    ...base,
    roundness: 3, // Paper multiplies this; gives 12px cards
    fonts: configureFonts({ config: { fontFamily: Platform.select({ ios: 'System', default: undefined }) } }),
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
