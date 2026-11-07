import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Searchbar } from 'react-native-paper';

import { TemplateCard } from '@/components/Cards';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useTemplates } from '@/features/queries';
import { useAppTheme } from '@/theme/theme';

/** Admin-curated templates only (decision D3 / §13.3 — no public UGC gallery in v1). */
export default function Templates() {
  const theme = useAppTheme();
  const templates = useTemplates();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<string | null>(null);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (templates.data ?? []).filter(
      (t) => (!kind || t.kind === kind) && (!q || `${t.name} ${t.description ?? ''} ${(t.tags ?? []).join(' ')}`.toLowerCase().includes(q)),
    );
  }, [templates.data, query, kind]);

  if (templates.isLoading) return <LoadingView />;
  if (templates.isError && !templates.data) return <ErrorView error={templates.error} onRetry={() => templates.refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.controls}>
        <Searchbar placeholder="Search templates" value={query} onChangeText={setQuery} elevation={0} />
        <View style={styles.chips}>
          {[
            { k: null, label: 'All' },
            { k: 'web', label: 'Web' },
            { k: 'mobile', label: 'Mobile' },
            { k: 'fullstack', label: 'Full stack' },
          ].map((c) => (
            <Chip key={c.label} selected={kind === c.k} onPress={() => setKind(c.k)} showSelectedCheck={false}>
              {c.label}
            </Chip>
          ))}
        </View>
      </View>
      <FlashList
        data={data}
        numColumns={2}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <TemplateCard template={item} />
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyView icon="view-grid-outline" title="No templates found" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { padding: 16, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { paddingHorizontal: 10, paddingBottom: 32 },
  cell: { flex: 1, padding: 6 },
});
