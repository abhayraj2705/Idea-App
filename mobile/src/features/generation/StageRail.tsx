import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/theme';

import { STAGES, STAGE_LABEL, type Stage } from './eventReducer';

export function StageRail({ stage, done, failed }: { stage: Stage; done: boolean; failed: boolean }) {
  const theme = useAppTheme();
  const current = STAGES.indexOf(stage);
  return (
    <View style={styles.rail} accessibilityRole="progressbar" accessibilityLabel={`Stage ${current + 1} of ${STAGES.length}: ${STAGE_LABEL[stage]}`}>
      {STAGES.map((s, i) => {
        const complete = i < current || (done && i === current && !failed);
        const active = i === current && !done;
        const errored = failed && i === current;
        const color = errored ? theme.colors.error : complete || active ? theme.colors.primary : theme.colors.textSubtle;
        return (
          <View key={s} style={styles.step}>
            <View style={styles.dotRow}>
              {i > 0 ? <View style={[styles.line, { backgroundColor: i <= current ? theme.colors.primary : theme.colors.border }]} /> : <View style={styles.lineSpacer} />}
              <View style={[styles.dot, { borderColor: color, backgroundColor: complete ? color : 'transparent' }]}>
                {complete ? (
                  <MaterialCommunityIcons name="check" size={14} color={theme.colors.onPrimary} />
                ) : errored ? (
                  <MaterialCommunityIcons name="close" size={14} color={color} />
                ) : active ? (
                  <ActivityIndicator size={12} color={color} />
                ) : null}
              </View>
              {i < STAGES.length - 1 ? <View style={[styles.line, { backgroundColor: i < current ? theme.colors.primary : theme.colors.border }]} /> : <View style={styles.lineSpacer} />}
            </View>
            <Text variant="labelSmall" style={{ color: active || complete ? theme.colors.onSurface : theme.colors.textMuted }} maxFontSizeMultiplier={1.4}>
              {STAGE_LABEL[s]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  dotRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  line: { flex: 1, height: 2 },
  lineSpacer: { flex: 1 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
