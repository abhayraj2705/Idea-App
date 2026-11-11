import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import { useTranslation } from '@/i18n';
import { useFeatures } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

import { nextStep, stepProgress, type BuilderStep } from './steps';

type Props = {
  step: BuilderStep;
  title: string;
  subtitle?: string;
  children: ReactNode;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** Runs before navigating; return false to stay. */
  onNext?: () => Promise<boolean | void> | boolean | void;
  footerExtra?: ReactNode;
  scroll?: boolean;
};

export function BuilderScaffold({ step, title, subtitle, children, nextLabel, nextDisabled, nextLoading, onNext, footerExtra, scroll = true }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const flags = useFeatures();
  const { index, total } = stepProgress(step, flags);
  const next = nextStep(step, flags);

  const go = async () => {
    const ok = onNext ? await onNext() : true;
    if (ok === false) return;
    if (next) router.push(`/builder/${next}` as Href);
  };

  return (
    <Screen
      keyboard
      scroll={scroll}
      footer={
        <>
          {footerExtra}
          <Button mode="contained" onPress={go} disabled={nextDisabled || nextLoading} loading={nextLoading} contentStyle={styles.btn}>
            {nextLabel ?? t('common.continue')}
          </Button>
        </>
      }
    >
      <View style={styles.head}>
        <View style={styles.steps} accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${index} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.step, { backgroundColor: i < index ? theme.colors.primary : theme.colors.surfaceVariant }]} />
          ))}
        </View>
        <Text variant="labelMedium" style={[styles.stepLabel, { color: theme.colors.textMuted }]} importantForAccessibility="no">
          Step {index} of {total}
        </Text>
        <Text variant="headlineSmall" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // flexShrink 0: when a step's content is taller than the screen, the scroll
  // container would otherwise squash the header and the title slid under the content.
  head: { gap: 4, flexShrink: 0 },
  steps: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepLabel: { textTransform: 'uppercase', letterSpacing: 0.6 },
  btn: { minHeight: 48 },
});
