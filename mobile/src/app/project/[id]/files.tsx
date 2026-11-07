import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Searchbar, Text, TouchableRipple } from 'react-native-paper';

import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { buildTreeRows, fuzzyScore, type TreeRow } from '@/features/project/fileTree';
import { useProject } from '@/features/queries';
import { formatBytes } from '@/lib/format';
import { useAppTheme } from '@/theme/theme';

export default function FilesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const project = useProject(id);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['src', 'app']));

  const files = useMemo(() => (project.data?.files ?? []).map((f) => ({ path: f.path, size: f.size ?? f.content?.length })), [project.data?.files]);

  const rows: TreeRow[] = useMemo(() => {
    const q = query.trim();
    if (q) {
      return files
        .map((f) => ({ f, s: fuzzyScore(q, f.path) }))
        .filter((x): x is { f: (typeof files)[number]; s: number } => x.s !== null)
        .sort((a, b) => a.s - b.s)
        .slice(0, 200)
        .map(({ f }) => ({ kind: 'file' as const, path: f.path, name: f.path, depth: 0, size: f.size }));
    }
    return buildTreeRows(files, expanded);
  }, [files, expanded, query]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (project.isLoading) return <LoadingView />;
  if (project.isError && !project.data) return <ErrorView error={project.error} onRetry={() => project.refetch()} />;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.search}>
        <Searchbar placeholder="Search files" value={query} onChangeText={setQuery} elevation={0} autoCapitalize="none" autoCorrect={false} />
      </View>
      <FlashList
        data={rows}
        keyExtractor={(r) => `${r.kind}:${r.path}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyView icon="file-search-outline" title={query ? 'No matching files' : 'No files yet'} />}
        renderItem={({ item }) => {
          const open = expanded.has(item.path);
          return (
            <TouchableRipple
              onPress={() => (item.kind === 'dir' ? toggle(item.path) : router.push({ pathname: '/project/[id]/file', params: { id, path: item.path } }))}
              style={[styles.row, { paddingLeft: 12 + item.depth * 16 }]}
              accessibilityRole="button"
              accessibilityLabel={item.kind === 'dir' ? `Folder ${item.name}, ${open ? 'expanded' : 'collapsed'}` : `File ${item.path}`}
            >
              <View style={styles.rowInner}>
                <MaterialCommunityIcons
                  name={item.kind === 'dir' ? (open ? 'folder-open-outline' : 'folder-outline') : 'file-code-outline'}
                  size={20}
                  color={item.kind === 'dir' ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text variant="bodyMedium" numberOfLines={1} style={styles.flex}>
                  {item.name}
                </Text>
                {item.kind === 'file' ? (
                  <Text variant="labelSmall" style={{ color: theme.colors.textSubtle }}>
                    {formatBytes(item.size)}
                  </Text>
                ) : (
                  <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-right'} size={18} color={theme.colors.textMuted} />
                )}
              </View>
            </TouchableRipple>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  search: { padding: 12 },
  list: { paddingBottom: 32 },
  row: { minHeight: 44, justifyContent: 'center', paddingRight: 16 },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
