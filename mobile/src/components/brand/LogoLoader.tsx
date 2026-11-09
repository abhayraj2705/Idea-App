import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme/theme';

import { LogoArrow, useLogoColors, type LogoColors } from './Logo';

type Props = LogoColors & {
  size?: number;
  /** Optional caption under the mark. Also used as the accessibility label. */
  label?: string;
};

/**
 * Animated brand loader: the arrow launches out through the tile's top-right
 * edge, re-enters from the bottom-left and settles with a small overshoot,
 * while the tile recoils slightly mid-flight. The tile clips the arrow, so it
 * reads as the mark "shipping" and coming back.
 *
 * Honors the OS reduce-motion setting with a gentle opacity pulse instead.
 */
export function LogoLoader({ size = 56, label, ...colors }: Props) {
  const theme = useAppTheme();
  const c = useLogoColors(colors);
  const reduceMotion = useReducedMotion();
  // p: 0 = at rest, (0,1] = flying out top-right, [-1,0) = flying in from bottom-left.
  const p = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = withRepeat(withTiming(0.55, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      p.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.in(Easing.cubic) }),
          withTiming(-1, { duration: 0 }),
          withTiming(0, { duration: 560, easing: Easing.out(Easing.back(1.5)) }),
          withDelay(420, withTiming(0, { duration: 0 })),
        ),
        -1,
      );
    }
    return () => {
      cancelAnimation(p);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, p, pulse]);

  const travel = size * 0.72;

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * travel }, { translateY: -p.value * travel }],
  }));

  const tileStyle = useAnimatedStyle(() => {
    const a = Math.abs(p.value);
    return {
      opacity: pulse.value,
      // Peaks mid-flight (a = 0.5), back to 1 at rest and at the edges.
      transform: [{ scale: 1 - 0.18 * a * (1 - a) }],
    };
  });

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      testID="logo-loader"
    >
      <Animated.View
        style={[
          { width: size, height: size, backgroundColor: c.tile, overflow: 'hidden' },
          tileStyle,
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, arrowStyle]}>
          <LogoArrow size={size} color={c.glyph} />
        </Animated.View>
      </Animated.View>
      {label ? (
        <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Full-screen branded loader used while the app boots (after the native splash hides). */
export function BootScreen() {
  const theme = useAppTheme();
  return (
    <View style={[styles.boot, { backgroundColor: theme.colors.background }]}>
      {/* 72dp matches the splash image (180dp × 0.4) so the handoff from the native splash is seamless. */}
      <LogoLoader size={72} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  label: { textAlign: 'center' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
