import { font } from './fonts';
import type { AppTheme } from './theme';

/**
 * Header options shared by every Stack and the tab navigator, so titles use the
 * same weight and size on every screen instead of each layout's defaults.
 */
export function headerOptions(theme: AppTheme) {
  return {
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: { fontFamily: font.semibold, fontSize: 17, color: theme.colors.onSurface },
  };
}
