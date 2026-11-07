import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Text } from 'react-native-paper';

import { aiApi, ApiError, errorMessage } from '@/api';
import { FileDiffCard } from '@/components/DiffView';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { qk, useProposal } from '@/features/queries';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';

/** Diff review: per-file unified hunks, Keep / Discard (§7.4). */
export default function ProposalReview() {
  const { id, pid } = useLocalSearchParams<{ id: string; pid: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const proposal = useProposal(pid);
  const [busy, setBusy] = useState<'apply' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  if (proposal.isLoading) return <LoadingView />;
  if (proposal.isError) return <ErrorView error={proposal.error} onRetry={() => proposal.refetch()} />;
  const p = proposal.data!;
  const additions = p.files.reduce((n, f) => n + f.additions, 0);
  const deletions = p.files.reduce((n, f) => n + f.deletions, 0);
  const pending = p.status === 'pending' && !conflict;

  const run = async (kind: 'apply' | 'discard') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'apply') {
        await aiApi.applyProposal(pid);
        track('proposal_applied', { files: p.files.length });
        haptics.success();
      } else {
        await aiApi.discardProposal(pid);
        track('proposal_discarded');
      }
      void qc.invalidateQueries({ queryKey: qk.project(id) });
      void qc.invalidateQueries({ queryKey: ['messages'] });
      void qc.invalidateQueries({ queryKey: qk.proposal(pid) });
      router.back();
    } catch (e) {
      haptics.error();
      if (e instanceof ApiError && e.isConflict) setConflict(true);
      else setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      footer={
        pending ? (
          <View style={styles.footer}>
            <Button mode="outlined" icon="close" style={styles.flex} onPress={() => run('discard')} loading={busy === 'discard'} disabled={!!busy}>
              Discard
            </Button>
            <Button mode="contained" icon="check" style={styles.flex} onPress={() => run('apply')} loading={busy === 'apply'} disabled={!!busy}>
              Keep
            </Button>
          </View>
        ) : conflict ? (
          <Button mode="contained" icon="refresh" onPress={() => router.replace(`/project/${id}/chat`)}>
            Ask again in chat
          </Button>
        ) : null
      }
    >
      <Banner visible={conflict} icon="alert-outline">
        The project changed since this suggestion. Ask again to regenerate it against the latest code.
      </Banner>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="titleMedium">{p.summary ?? 'Proposed changes'}</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
            {p.files.length} files ·{' '}
            <Text variant="bodySmall" style={{ color: theme.colors.success }}>
              +{additions}
            </Text>{' '}
            <Text variant="bodySmall" style={{ color: theme.colors.error }}>
              −{deletions}
            </Text>
          </Text>
        </View>
        <StatusChip status={p.status === 'applied' ? 'complete' : p.status === 'discarded' ? 'cancelled' : 'pending'} label={p.status} />
      </View>
      {p.files.map((f, i) => (
        <FileDiffCard key={f.path} diff={f} initiallyOpen={i === 0} />
      ))}
      {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  footer: { flexDirection: 'row', gap: 12 },
});
