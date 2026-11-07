import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

import { errorMessage } from '@/api/client';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function LoadingView({ label }: { label?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator color={theme.colors.primary} />
      {label ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyView({
  icon = 'lightbulb-outline',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon} size={32} color={theme.colors.primary} />
      </View>
      <Text variant="titleMedium" style={styles.text} accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.textMuted }]}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorView({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.errorContainer }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={32} color={theme.colors.error} />
      </View>
      <Text variant="titleMedium" style={styles.text}>
        {title ?? t('common.somethingWrong')}
      </Text>
      <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.textMuted }]}>
        {errorMessage(error)}
      </Text>
      {onRetry ? (
        <Button mode="outlined" icon="refresh" onPress={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, minHeight: 240 },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  text: { textAlign: 'center' },
});
