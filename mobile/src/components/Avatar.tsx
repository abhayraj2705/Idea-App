import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { font } from '@/theme/fonts';
import { useAppTheme } from '@/theme/theme';

/** Up to two initials: "Ada Lovelace" → "AL", "ada@x.dev" → "A". */
export function initials(name?: string | null) {
  const clean = (name ?? '').split('@')[0]!.trim();
  if (!clean) return '?';
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : clean.slice(0, 1);
  return letters.toUpperCase();
}

/**
 * Neutral initials avatar. Paper's Avatar.Text fills with the brand accent, which
 * made every avatar look like a call-to-action.
 */
export function Avatar({
  name,
  size = 40,
  onPress,
  accessibilityLabel,
}: {
  name?: string | null;
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const body = (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border }]}
      importantForAccessibility={onPress ? 'no-hide-descendants' : 'auto'}
    >
      <Text style={{ fontFamily: font.semibold, fontSize: Math.round(size * 0.38), color: theme.colors.onSurface }} maxFontSizeMultiplier={1}>
        {initials(name)}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});
