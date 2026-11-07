import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ProgressBar, Text } from 'react-native-paper';

import type { Quota } from '@/api/types';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { formatTime } from '@/lib/format';
import { useAppTheme } from '@/theme/theme';

export function isQuotaExhausted(q?: Quota | null) {
  return !!q && !q.unlimited && q.limit != null && q.used >= q.limit;
}

/** Hidden when unlimited. Never shows prices or upgrade CTAs (§6.7). */
export function QuotaMeter({ quota }: { quota?: Quota | null }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const exhausted = isQuotaExhausted(quota);

  useEffect(() => {
    if (exhausted) track('quota_exhausted');
  }, [exhausted]);

  if (!quota || quota.unlimited || quota.limit == null) return null;
  const ratio = quota.limit > 0 ? Math.min(1, quota.used / quota.limit) : 1;
  const time = formatTime(quota.resetsAt);

  return (
    <Card mode="contained" style={{ backgroundColor: exhausted ? theme.colors.errorContainer : theme.colors.surfaceVariant }}>
      <Card.Content style={styles.content}>
        <View style={styles.row}>
          <MaterialCommunityIcons
            name={exhausted ? 'timer-sand-complete' : 'lightning-bolt-outline'}
            size={18}
            color={exhausted ? theme.colors.error : theme.colors.primary}
          />
          <Text variant="labelLarge" style={styles.flex}>
            {exhausted
              ? t('home.quotaExhausted', { time: time || 'midnight' })
              : t('home.quota', { used: quota.used, limit: quota.limit })}
          </Text>
        </View>
        <ProgressBar
          progress={ratio}
          color={exhausted ? theme.colors.error : theme.colors.primary}
          style={styles.bar}
          accessibilityLabel={`${quota.used} of ${quota.limit} used`}
        />
        {!exhausted && time ? (
          <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
            {t('home.quotaResets', { time })}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  bar: { height: 6, borderRadius: 3 },
});
