import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { router } from 'expo-router';
import { Button, Searchbar, Snackbar } from 'react-native-paper';

import { errorMessage, projectsApi, type ProjectFilter, type ProjectSummary } from '@/api';
import { ProjectCard } from '@/components/Cards';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { Segmented } from '@/components/Segmented';
import { useProjects } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/stores/session';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

export default function Projects() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const [filter, setFilter] = useState<ProjectFilter>('mine');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const projects = useProjects(filter);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.data ?? [];
    return q ? list.filter((p) => `${p.name} ${p.description ?? ''} ${p.stack ?? ''}`.toLowerCase().includes(q)) : list;
  }, [projects.data, query]);

  const remove = async () => {
    if (!toDelete) return;
    try {
      await projectsApi.remove(toDelete.id);
      haptics.success();
      qc.setQueryData<ProjectSummary[]>(['projects', filter], (old) => old?.filter((p) => p.id !== toDelete.id));
      void qc.invalidateQueries({ queryKey: ['projects'] });
      setSnack('Project deleted');
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setToDelete(null);
    }
  };

  const renderItem = ({ item }: { item: ProjectSummary }) => {
    const mine = !item.ownerId || item.ownerId === me?.id;
    if (!mine) return <ProjectCard project={item} />;
    return (
      <Swipeable
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        // At rest the delete action sits under the card; its red bled through the card's rounded,
        // anti-aliased edge. An opaque content layer hides it, and the clipped container keeps
        // the revealed action inside the card's shape.
        containerStyle={styles.swipeContainer}
        childrenContainerStyle={{ backgroundColor: theme.colors.background }}
        renderRightActions={() => (
          <Pressable
            onPress={() => setToDelete(item)}
            style={[styles.swipeAction, { backgroundColor: theme.colors.error }]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.colors.onError} />
          </Pressable>
        )}
      >
        <ProjectCard project={item} onLongPress={() => setToDelete(item)} />
      </Swipeable>
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <View style={styles.controls}>
        <Searchbar placeholder={t('projects.search')} value={query} onChangeText={setQuery} mode="bar" elevation={0} accessibilityLabel={t('projects.search')} />
        <Segmented
          value={filter}
          onValueChange={(v) => setFilter(v as ProjectFilter)}
          buttons={[
            { value: 'mine', label: t('projects.mine'), icon: 'account-outline' },
            { value: 'team', label: t('projects.team'), icon: 'account-group-outline' },
            { value: 'public', label: t('projects.public'), icon: 'earth' },
          ]}
        />
        <OfflineBanner />
      </View>
      {projects.isLoading ? (
        <LoadingView />
      ) : projects.isError && !projects.data ? (
        <ErrorView error={projects.error} onRetry={() => projects.refetch()} />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.list}
          onRefresh={() => projects.refetch()}
          refreshing={projects.isRefetching}
          ListEmptyComponent={
            query.trim() ? (
              <EmptyView icon="magnify" title={t('projects.noMatch', { query: query.trim() })} body={t('projects.noMatchBody')} />
            ) : filter === 'team' ? (
              <EmptyView icon="account-group-outline" title={t('projects.emptyTeam')} body={t('projects.emptyTeamBody')} />
            ) : filter === 'public' ? (
              <EmptyView icon="earth" title={t('projects.emptyPublic')} body={t('projects.emptyPublicBody')} />
            ) : (
              <EmptyView
                icon="folder-outline"
                title={t('projects.empty')}
                body={t('projects.emptyBody')}
                action={
                  <Button mode="contained" icon="plus" onPress={() => router.push('/builder/idea')}>
                    {t('home.newIdea')}
                  </Button>
                }
              />
            )
          }
        />
      )}
      <ConfirmDialog
        visible={!!toDelete}
        title={t('common.delete')}
        body={toDelete ? t('projects.deleteConfirm', { name: toDelete.name }) : ''}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={remove}
        onDismiss={() => setToDelete(null)}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  controls: { padding: 16, gap: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  swipeContainer: { borderRadius: radius.control, overflow: 'hidden' },
  swipeAction: { width: 88, alignItems: 'center', justifyContent: 'center' },
});
