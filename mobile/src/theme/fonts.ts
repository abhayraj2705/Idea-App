import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';

/**
 * Brand typeface: Plus Jakarta Sans. Each weight is its own family, because
 * Android can't pick a weight out of a single custom family — so styles choose
 * a family below instead of setting `fontWeight` (which would fake-bold it).
 * Only the weights we use are bundled.
 */
export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontAssets = {
  [font.regular]: PlusJakartaSans_400Regular,
  [font.medium]: PlusJakartaSans_500Medium,
  [font.semibold]: PlusJakartaSans_600SemiBold,
  [font.bold]: PlusJakartaSans_700Bold,
  [font.extrabold]: PlusJakartaSans_800ExtraBold,
};
