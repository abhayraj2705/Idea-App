import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { QuotaMeter } from '@/components/QuotaMeter';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useQuota, useUsage } from '@/features/queries';
import { useAppTheme } from '@/theme/theme';

export default function Usage() {
  const theme = useAppTheme();
  const usage = useUsage();
  const quota = useQuota();

  if (usage.isLoading) return <LoadingView />;
  if (usage.isError) return <ErrorView error={usage.error} onRetry={() => usage.refetch()} />;
  const u = usage.data!;
  const days = (u.byDay ?? []).slice(-14);
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <Screen refreshing={usage.isRefetching} onRefresh={() => usage.refetch()}>
      <QuotaMeter quota={quota.data} />
      <View style={styles.tiles}>
        <Card mode="contained" style={styles.tile}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
              Generations
            </Text>
            <Text variant="headlineMedium">{u.generations.toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={styles.tile}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
              Tokens
            </Text>
            <Text variant="headlineMedium">{u.tokens >= 1e6 ? `${(u.tokens / 1e6).toFixed(1)}M` : u.tokens.toLocaleString()}</Text>
          </Card.Content>
        </Card>
      </View>
      {days.length ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          <Card.Title title="Last 14 days" />
          <Card.Content>
            <View style={styles.chart} accessibilityLabel={`Generations per day, last ${days.length} days`}>
              {days.map((d) => (
                <View key={d.date} style={styles.barWrap} accessible accessibilityLabel={`${d.date}: ${d.count}`}>
                  <View style={[styles.bar, { height: `${(d.count / max) * 100}%`, backgroundColor: theme.colors.primary }]} />
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 2 },
});
