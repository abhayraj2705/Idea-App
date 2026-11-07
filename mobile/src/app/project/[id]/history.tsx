import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import { errorMessage, projectsApi, type Checkpoint } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { qk, useCheckpoints } from '@/features/queries';
import { track } from '@/lib/analytics';
import { timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';

/** Restore points. Restoring is append-only: it adds a new point, never rewinds (§7.4). */
export default function History() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const checkpoints = useCheckpoints(id);
  const [target, setTarget] = useState<Checkpoint | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  if (checkpoints.isLoading) return <LoadingView />;
  if (checkpoints.isError) return <ErrorView error={checkpoints.error} onRetry={() => checkpoints.refetch()} />;
  const list = [...(checkpoints.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const restore = async () => {
    if (!target) return;
    try {
      await projectsApi.restoreCheckpoint(id, target.id);
      track('checkpoint_restored');
      haptics.success();
      setSnack('New restore point added');
      void qc.invalidateQueries({ queryKey: qk.checkpoints(id) });
      void qc.invalidateQueries({ queryKey: qk.project(id) });
      void qc.invalidateQueries({ queryKey: ['messages'] });
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setTarget(null);
    }
  };

  return (
    <>
      <Screen refreshing={checkpoints.isRefetching} onRefresh={() => checkpoints.refetch()}>
        <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
          Every change creates a restore point. Restoring adds a new point on top — your history is never lost.
        </Text>
        {list.length === 0 ? <EmptyView icon="history" title="No restore points yet" /> : null}
        {list.map((c, i) => (
          <Card key={c.id} mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Title
              title={c.label ?? `Restore point ${list.length - i}`}
              subtitle={[timeAgo(c.createdAt), c.fileCount != null ? `${c.fileCount} files` : null].filter(Boolean).join(' · ')}
              right={() =>
                i === 0 ? (
                  <Text variant="labelSmall" style={[styles.current, { color: theme.colors.primary }]}>
                    CURRENT
                  </Text>
                ) : (
                  <View style={styles.right}>
                    <Button compact icon="restore" onPress={() => setTarget(c)}>
                      Restore
                    </Button>
                  </View>
                )
              }
            />
          </Card>
        ))}
      </Screen>
      <ConfirmDialog
        visible={!!target}
        title="Restore this point?"
        body="This adds a new restore point with the project as it was then. Nothing is deleted."
        confirmLabel="Add restore point"
        onConfirm={restore}
        onDismiss={() => setTarget(null)}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({ current: { marginRight: 16 }, right: { marginRight: 8 } });
