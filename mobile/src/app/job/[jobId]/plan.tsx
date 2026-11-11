import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, List, Text } from 'react-native-paper';
import { TextInput } from '@/components/TextInput';

import { aiApi } from '@/api/endpoints/ai';
import { errorMessage } from '@/api/client';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { qk } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';

type PlanModule = { name?: string; title?: string; description?: string; files?: unknown[] };

/** Plan approval / adjust (planApprovalGate, §7.3). */
export default function PlanScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'adjust' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan = useQuery({
    queryKey: ['plan', jobId],
    queryFn: async () => {
      const events = await aiApi.events(jobId, 0);
      const ready = [...events].reverse().find((e) => e.type === 'plan_ready');
      return (ready?.data ?? null) as Record<string, unknown> | null;
    },
  });

  const modules = ((plan.data?.modules ?? plan.data?.steps ?? []) as PlanModule[]).filter(Boolean);
  const summary = typeof plan.data?.summary === 'string' ? plan.data.summary : undefined;

  const run = async (kind: 'approve' | 'adjust') => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'approve') await aiApi.approvePlan(jobId);
      else await aiApi.adjustPlan(jobId, feedback.trim());
      haptics.success();
      void qc.invalidateQueries({ queryKey: qk.job(jobId) });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      keyboard
      footer={
        adjusting ? (
          <>
            <Button mode="contained" onPress={() => run('adjust')} loading={busy === 'adjust'} disabled={!!busy || feedback.trim().length < 5}>
              Send changes
            </Button>
            <Button onPress={() => setAdjusting(false)}>{t('common.cancel')}</Button>
          </>
        ) : (
          <>
            <Button mode="contained" icon="check" onPress={() => run('approve')} loading={busy === 'approve'} disabled={!!busy || !plan.data}>
              {t('job.approvePlan')}
            </Button>
            <Button icon="pencil-outline" onPress={() => setAdjusting(true)} disabled={!!busy}>
              {t('job.adjustPlan')}
            </Button>
          </>
        )
      }
    >
      {plan.isLoading ? <LoadingView /> : null}
      {plan.isError ? <ErrorView error={plan.error} onRetry={() => plan.refetch()} /> : null}
      {plan.data === null ? <Text variant="bodyMedium">No plan is waiting for approval.</Text> : null}
      {summary ? <Text variant="bodyLarge">{summary}</Text> : null}
      {modules.length ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          {modules.map((m, i) => (
            <List.Item
              key={i}
              title={m.title ?? m.name ?? `Step ${i + 1}`}
              description={[m.description, Array.isArray(m.files) ? `${m.files.length} files` : null].filter(Boolean).join(' · ')}
              descriptionNumberOfLines={3}
              left={(p) => <List.Icon {...p} icon={`numeric-${Math.min(i + 1, 9)}-circle-outline`} />}
            />
          ))}
        </Card>
      ) : null}
      {adjusting ? (
        <View style={styles.gap}>
          <TextInput mode="outlined" multiline label="What should change?" value={feedback} onChangeText={setFeedback} style={styles.input} autoFocus maxLength={2000} />
        </View>
      ) : null}
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: 8 }, input: { minHeight: 120 } });
