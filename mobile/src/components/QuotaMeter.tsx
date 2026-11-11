import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { Quota } from '@/api/types';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { formatTime } from '@/lib/format';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

export function isQuotaExhausted(q?: Quota | null) {
  return !!q && !q.unlimited && q.limit != null && q.used >= q.limit;
}

/**
 * Compact daily-usage line with a thin bar. Quiet while there's headroom; turns
 * into an error panel only when the limit is reached.
 * Hidden when unlimited. Never shows prices or upgrade CTAs (§6.7).
 */
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

  if (exhausted) {
    return (
      <View style={[styles.panel, { backgroundColor: theme.colors.errorContainer }]} accessibilityRole="alert">
        <MaterialCommunityIcons name="timer-sand-complete" size={18} color={theme.colors.error} />
        <Text variant="bodyMedium" style={[styles.flex, { color: theme.colors.onErrorContainer }]}>
          {t('home.quotaExhausted', { time: time || 'midnight' })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${t('home.quota', { used: quota.used, limit: quota.limit })}. ${time ? t('home.quotaResets', { time }) : ''}`}>
      <View style={styles.row}>
        <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.textMuted }]}>
          {t('home.quota', { used: quota.used, limit: quota.limit })}
        </Text>
        {/* A rolling window with nothing used would "reset" a full window from now, which reads oddly. */}
        {time && quota.used > 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.textSubtle }}>
            {t('home.quotaResets', { time })}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: ratio >= 0.8 ? theme.colors.warning : theme.colors.onSurface }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: 2 },
  panel: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.control },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  track: { height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2 },
});
