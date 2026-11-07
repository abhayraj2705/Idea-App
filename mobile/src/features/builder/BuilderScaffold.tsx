import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';

import { Screen } from '@/components/Screen';
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
            {nextLabel ?? 'Next'}
          </Button>
        </>
      }
    >
      <View style={styles.head}>
        <ProgressBar progress={index / total} color={theme.colors.primary} style={styles.bar} accessibilityLabel={`Step ${index} of ${total}`} />
        <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
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
  head: { gap: 6 },
  bar: { height: 4, borderRadius: 2 },
  btn: { minHeight: 48 },
});
