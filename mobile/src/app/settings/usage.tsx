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
            <Text variant="labelMedium" style={{ color: theme.colors.textMuted }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              Generations
            </Text>
            <Text variant="headlineMedium">{u.generations.toLocaleString()}</Text>
          </Card.Content>
        </Card>
        <Card mode="contained" style={styles.tile}>
          <Card.Content>
            <Text variant="labelMedium" style={{ color: theme.colors.textMuted }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
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
              {days.map((d, i) => {
                const today = i === days.length - 1;
                return (
                  <View key={d.date} style={styles.barCol} accessible accessibilityLabel={`${dayLabel(d.date, 'long')}: ${d.count} ${d.count === 1 ? 'generation' : 'generations'}`}>
                    <View style={styles.barWrap}>
                      {d.count ? (
                        <Text variant="labelSmall" style={[styles.count, { color: theme.colors.textMuted }]}>
                          {d.count}
                        </Text>
                      ) : null}
                      <View
                        style={[
                          styles.bar,
                          d.count
                            ? { height: `${(d.count / max) * 82}%`, backgroundColor: theme.colors.primary, opacity: today ? 1 : 0.75 }
                            : { height: 3, backgroundColor: theme.colors.border },
                        ]}
                      />
                    </View>
                    <Text variant="labelSmall" style={{ color: today ? theme.colors.onSurface : theme.colors.textSubtle }} maxFontSizeMultiplier={1.2}>
                      {dayLabel(d.date, 'narrow')}
                    </Text>
                  </View>
                );
              })}
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
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 4 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', gap: 6 },
  barWrap: { flex: 1, alignSelf: 'stretch', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  bar: { alignSelf: 'stretch', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  count: { fontSize: 10 },
});

/** Weekday from a YYYY-MM-DD date, parsed as a local date (not UTC midnight). */
function dayLabel(iso: string, style: 'narrow' | 'long'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString(undefined, style === 'long' ? { weekday: 'long', month: 'short', day: 'numeric' } : { weekday: 'narrow' });
}
