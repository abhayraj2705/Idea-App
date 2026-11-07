import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import type { TimelineStatus } from '@/api/types';
import { formatTime } from '@/lib/format';
import { useAppTheme } from '@/theme/theme';

export type TimelineItem = { id: string; label: string; status: TimelineStatus; at?: string; detail?: string };

/** Vertical status timeline for deploys and builds (§7.7). */
export function Timeline({ items }: { items: TimelineItem[] }) {
  const theme = useAppTheme();
  return (
    <View accessibilityRole="list">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const color =
          item.status === 'succeeded'
            ? theme.colors.success
            : item.status === 'failed'
              ? theme.colors.error
              : item.status === 'running'
                ? theme.colors.primary
                : theme.colors.textSubtle;
        return (
          <View key={item.id} style={styles.row} accessible accessibilityLabel={`${item.label}: ${item.status}`}>
            <View style={styles.rail}>
              <View style={[styles.dot, { borderColor: color }]}>
                {item.status === 'running' ? (
                  <ActivityIndicator size={12} color={color} />
                ) : item.status === 'succeeded' ? (
                  <MaterialCommunityIcons name="check" size={14} color={color} />
                ) : item.status === 'failed' ? (
                  <MaterialCommunityIcons name="close" size={14} color={color} />
                ) : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: theme.colors.border }]} /> : null}
            </View>
            <View style={styles.body}>
              <Text variant="bodyLarge">{item.label}</Text>
              {item.detail ? (
                <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                  {item.detail}
                </Text>
              ) : null}
              {item.at ? (
                <Text variant="labelSmall" style={{ color: theme.colors.textSubtle }}>
                  {formatTime(item.at)}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 20, marginVertical: 2 },
  body: { flex: 1, paddingBottom: 18, gap: 2 },
});
