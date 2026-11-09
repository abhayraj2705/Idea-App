import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';


import type { Job } from '@/api/types';
import { JobRow } from '@/components/Cards';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { Segmented } from '@/components/Segmented';
import { useJobs } from '@/features/queries';
import { useAppTheme } from '@/theme/theme';

type Filter = 'all' | 'running' | 'done';

/** Jobs list (GET /api/ai/jobs) — doubles as the notification inbox (§7). */
export default function Activity() {
  const theme = useAppTheme();
  const jobs = useJobs();
  const [filter, setFilter] = useState<Filter>('all');

  const data = useMemo(() => {
    const list = [...(jobs.data ?? [])].sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));
    const isRunning = (j: Job) => j.status === 'running' || j.status === 'queued' || j.status === 'awaiting_plan_approval';
    if (filter === 'running') return list.filter(isRunning);
    if (filter === 'done') return list.filter((j) => !isRunning(j));
    return list;
  }, [jobs.data, filter]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.controls}>
        <Segmented
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'running', label: 'Running', icon: 'progress-clock' },
            { value: 'done', label: 'Finished', icon: 'check-all' },
          ]}
        />
      </View>
      {jobs.isLoading ? (
        <LoadingView />
      ) : jobs.isError && !jobs.data ? (
        <ErrorView error={jobs.error} onRetry={() => jobs.refetch()} />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(j) => j.id}
          renderItem={({ item }) => <JobRow job={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.list}
          onRefresh={() => jobs.refetch()}
          refreshing={jobs.isRefetching}
          ListEmptyComponent={<EmptyView icon="bell-outline" title="No activity yet" body="Generations, builds and deploys show up here." />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { padding: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
});
