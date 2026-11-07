import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme, type AppTheme } from '@/theme/theme';

import type { IconName } from './StateViews';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error' | 'info';

const STATUS_MAP: Record<string, { tone: StatusTone; icon: IconName; label: string }> = {
  queued: { tone: 'neutral', icon: 'clock-outline', label: 'Queued' },
  running: { tone: 'accent', icon: 'progress-clock', label: 'Building' },
  generating: { tone: 'accent', icon: 'progress-clock', label: 'Building' },
  building: { tone: 'accent', icon: 'progress-wrench', label: 'Building' },
  awaiting_plan_approval: { tone: 'warning', icon: 'clipboard-check-outline', label: 'Needs approval' },
  complete: { tone: 'success', icon: 'check-circle-outline', label: 'Ready' },
  succeeded: { tone: 'success', icon: 'check-circle-outline', label: 'Succeeded' },
  partial: { tone: 'warning', icon: 'alert-outline', label: 'With issues' },
  failed: { tone: 'error', icon: 'close-circle-outline', label: 'Failed' },
  cancelled: { tone: 'neutral', icon: 'cancel', label: 'Cancelled' },
  draft: { tone: 'neutral', icon: 'pencil-outline', label: 'Draft' },
  pending: { tone: 'neutral', icon: 'clock-outline', label: 'Pending' },
  ga: { tone: 'success', icon: 'check-decagram-outline', label: 'Stable' },
  beta: { tone: 'info', icon: 'flask-outline', label: 'Beta' },
  experimental: { tone: 'warning', icon: 'flask-empty-outline', label: 'Experimental' },
};

export function toneColors(theme: AppTheme, tone: StatusTone) {
  const c = theme.colors;
  switch (tone) {
    case 'accent':
      return { bg: c.primaryContainer, fg: c.onPrimaryContainer, icon: c.primary };
    case 'success':
      return { bg: c.successContainer, fg: c.onSurface, icon: c.success };
    case 'warning':
      return { bg: c.warningContainer, fg: c.onSurface, icon: c.warning };
    case 'error':
      return { bg: c.errorContainer, fg: c.onErrorContainer, icon: c.error };
    case 'info':
      return { bg: c.infoContainer, fg: c.onSurface, icon: c.info };
    default:
      return { bg: c.surfaceVariant, fg: c.onSurfaceVariant, icon: c.textMuted };
  }
}

export function StatusChip({ status, label, compact }: { status: string; label?: string; compact?: boolean }) {
  const theme = useAppTheme();
  const meta = STATUS_MAP[status] ?? { tone: 'neutral' as const, icon: 'information-outline' as IconName, label: status };
  const colors = toneColors(theme, meta.tone);
  const text = label ?? meta.label;
  return (
    <View
      style={[styles.chip, compact && styles.compact, { backgroundColor: colors.bg }]}
      accessibilityLabel={`Status: ${text}`}
      accessible
    >
      <MaterialCommunityIcons name={meta.icon} size={compact ? 12 : 14} color={colors.icon} />
      <Text variant="labelSmall" style={{ color: colors.fg }} maxFontSizeMultiplier={1.6}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  compact: { paddingHorizontal: 6, paddingVertical: 2 },
});
