import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from 'react-native';
import { Button, HelperText, RadioButton, Text, TouchableRipple } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import type { IconName } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { useCapabilities } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function Onboarding() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const [stack, setStack] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caps = useCapabilities();
  const stacks = (caps.data?.stacks ?? []).filter((s) => s.status !== 'experimental');

  const cards: { icon: IconName; title: string; body: string }[] = [
    { icon: 'text-box-edit-outline', title: t('onboarding.cards.describe.title'), body: t('onboarding.cards.describe.body') },
    { icon: 'progress-wrench', title: t('onboarding.cards.watch.title'), body: t('onboarding.cards.watch.body') },
    { icon: 'rocket-launch-outline', title: t('onboarding.cards.ship.title'), body: t('onboarding.cards.ship.body') },
  ];
  const pages = cards.length + 1;

  const go = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await authApi.completeOnboarding({ defaultStack: stack });
      useSession.getState().setUser({ ...user, onboardingCompleted: true });
      track('onboarding_complete', { stack: stack ?? 'none' });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.top}>
        <Button onPress={finish} disabled={busy}>
          {t('onboarding.skip')}
        </Button>
      </View>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={styles.flex}>
        {cards.map((c) => (
          <View key={c.icon} style={[styles.page, { width }]}>
            <View style={[styles.bigIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name={c.icon} size={56} color={theme.colors.primary} />
            </View>
            <Text variant="headlineMedium" style={styles.center} accessibilityRole="header">
              {c.title}
            </Text>
            <Text variant="bodyLarge" style={[styles.center, { color: theme.colors.textMuted }]}>
              {c.body}
            </Text>
          </View>
        ))}
        <ScrollView style={{ width }} contentContainerStyle={styles.stackPage}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {t('onboarding.pickStack')}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
            {t('onboarding.pickStackBody')}
          </Text>
          <RadioButton.Group onValueChange={setStack} value={stack ?? ''}>
            {stacks.map((s) => (
              <TouchableRipple key={s.id} onPress={() => setStack(s.id)} style={[styles.option, { borderColor: stack === s.id ? theme.colors.primary : theme.colors.border }]} accessibilityRole="radio" accessibilityState={{ checked: stack === s.id }}>
                <View style={styles.optionRow}>
                  <RadioButton value={s.id} />
                  <View style={styles.flex}>
                    <Text variant="titleSmall">{s.name}</Text>
                    {s.description ? (
                      <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                        {s.description}
                      </Text>
                    ) : null}
                  </View>
                  <StatusChip status={s.status} compact />
                </View>
              </TouchableRipple>
            ))}
          </RadioButton.Group>
        </ScrollView>
      </ScrollView>

      <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${pages}`}>
        {Array.from({ length: pages }).map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? theme.colors.primary : theme.colors.border, width: i === page ? 20 : 8 }]} />
        ))}
      </View>
      {error ? (
        <HelperText type="error" visible style={styles.center}>
          {error}
        </HelperText>
      ) : null}
      <View style={styles.footer}>
        {page < pages - 1 ? (
          <Button mode="contained" onPress={() => go(page + 1)} contentStyle={styles.btn}>
            {t('common.next')}
          </Button>
        ) : (
          <Button mode="contained" onPress={finish} loading={busy} disabled={busy} contentStyle={styles.btn}>
            {t('onboarding.getStarted')}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { alignItems: 'flex-end', paddingHorizontal: 8 },
  page: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  bigIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  center: { textAlign: 'center' },
  stackPage: { padding: 24, gap: 12 },
  option: { borderWidth: 1, borderRadius: 12, padding: 8, marginBottom: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  dot: { height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: 16 },
  btn: { minHeight: 48 },
});
