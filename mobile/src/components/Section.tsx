import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/theme';

export function Section({
  title,
  action,
  onAction,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="titleMedium" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action && onAction ? (
          <Button compact onPress={onAction}>
            {action}
          </Button>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  titles: { flex: 1, gap: 2 },
});
