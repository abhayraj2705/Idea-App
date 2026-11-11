import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Dialog, List, Portal, Snackbar, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { aiApi } from '@/api/endpoints/ai';
import { errorMessage } from '@/api/client';
import { CodeViewer } from '@/components/code/CodeViewer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { isTerminal, type FileEntry } from '@/features/generation/eventReducer';
import { StageRail } from '@/features/generation/StageRail';
import { useJobStream } from '@/features/generation/useJobStream';
import { qk, useJob, useProject } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { durationBucket, track } from '@/lib/analytics';
import { supportMailto } from '@/lib/support';
import { formatBytes, formatDuration, languageFromPath } from '@/lib/format';
import { useFeatures, useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

const REPORT_LABELS: Record<string, string> = {
  validation_report: 'Validation',
  typecheck_report: 'Type check',
  compile_report: 'Compile',
  verification_report: 'Verification',
  quality_report: 'Quality',
  issue_ledger: 'Issue ledger',
  preview_readiness: 'Preview readiness',
  budget_report: 'Budget',
  repair_report: 'Repair',
  codemod_report: 'Codemods',
  completeness_gap: 'Completeness',
  phase_diagnostic: 'Diagnostics',
};

function summarize(data: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length < 80)) parts.push(`${k}: ${String(v)}`);
    else if (Array.isArray(v)) parts.push(`${k}: ${v.length}`);
    if (parts.length >= 6) break;
  }
  return parts.join('\n') || 'No details';
}

export default function JobScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const flags = useFeatures();
  const userId = useSession((s) => s.user?.id);
  const reduceMotion = useReducedMotion();
  // With large system text, stack the success actions full-width instead of truncating them.
  const stackActions = useWindowDimensions().fontScale > 1.3;
  const job = useJob(jobId);
  const { state, mode } = useJobStream(jobId);
  const [now, setNow] = useState(() => Date.now());
  const [peek, setPeek] = useState<FileEntry | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const done = isTerminal(state) || job.data?.status === 'cancelled';
  // The stream's `complete` event doesn't carry the outcome; the job record does.
  // Once the run has ended, a server-side partial/failed verdict wins.
  const serverEnd = job.data?.status === 'partial' || job.data?.status === 'failed' ? job.data.status : undefined;
  const endStatus = state.endStatus ? (serverEnd ?? state.endStatus) : undefined;
  const tracked = useRef(false);

  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [done]);

  const startedAt = job.data?.createdAt ? new Date(job.data.createdAt).getTime() : undefined;
  // A finished job must never keep ticking: fall back to updatedAt when the
  // backend omits finishedAt (older jobs), and only use the live clock while running.
  const endedAt = job.data?.finishedAt
    ? new Date(job.data.finishedAt).getTime()
    : done && job.data?.updatedAt
      ? new Date(job.data.updatedAt).getTime()
      : undefined;
  const elapsed = startedAt ? Math.max(0, (endedAt ?? now) - startedAt) : 0;
  const durationLabel = startedAt ? `${done ? 'Took' : 'Elapsed'} ${formatDuration(elapsed)}` : null;
  const projectId = state.projectId ?? job.data?.projectId;
  const project = useProject(done ? projectId : undefined);
  // Historical jobs may no longer replay their file stream; the project still knows its file count.
  const fileCount = state.files.length || project.data?.fileCount || 0;

  useEffect(() => {
    if (state.endStatus && !tracked.current) {
      tracked.current = true;
      track('generation_finished', { status: state.endStatus, duration: durationBucket(elapsed) });
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: qk.job(jobId) });
      void qc.invalidateQueries({ queryKey: ['projects'] });
      if (projectId) void qc.invalidateQueries({ queryKey: qk.project(projectId) });
    }
  }, [state.endStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (name: string, fn: () => Promise<{ jobId?: string } | unknown>) => {
    setBusy(name);
    try {
      const res = (await fn()) as { jobId?: string } | undefined;
      if (res && typeof res === 'object' && 'jobId' in res && res.jobId && res.jobId !== jobId) {
        router.replace(`/job/${res.jobId}`);
      }
      void qc.invalidateQueries({ queryKey: qk.job(jobId) });
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const healing = state.healing;
  const reports = Object.entries(state.reports);
  const readiness = state.reports.preview_readiness;

  return (
    <>
      <Stack.Screen
        options={{
          title: job.data?.projectName ?? 'Generating',
          headerRight: () =>
            !done ? (
              <Button compact textColor={theme.colors.error} onPress={() => setConfirmCancel(true)}>
                {t('job.cancel')}
              </Button>
            ) : null,
        }}
      />
      <Screen>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
              {[job.data?.stack ?? project.data?.stack, durationLabel].filter(Boolean).join(' · ')}
            </Text>
            {/* Once there's an outcome, the result card below says it; repeating "Finished"/"Ready" here was noise. */}
            {!state.endStatus ? <Text variant="titleMedium">{state.phaseLabel || (done ? 'Stopped' : 'Starting…')}</Text> : null}
          </View>
          {!state.endStatus ? <StatusChip status={job.data?.status ?? state.status} /> : null}
        </View>

        <StageRail stage={state.stage} done={!!endStatus} failed={endStatus === 'failed'} />

        {mode === 'reconnecting' || mode === 'polling' ? (
          <View style={[styles.notice, { backgroundColor: theme.colors.surfaceVariant }]} accessibilityLiveRegion="polite">
            <MaterialCommunityIcons name="wifi-sync" size={16} color={theme.colors.textMuted} />
            <Text variant="bodySmall" style={{ color: theme.colors.textMuted, flex: 1 }}>
              {mode === 'polling' ? t('job.polling') : t('job.reconnecting')}
            </Text>
          </View>
        ) : null}

        {state.planPending && flags.planApprovalGate ? (
          <Card mode="contained" style={{ backgroundColor: theme.colors.warningContainer }}>
            <Card.Title title="The plan is ready for review" subtitle="Approve it to start generating." left={(p) => <MaterialCommunityIcons name="clipboard-check-outline" size={p.size} color={theme.colors.warning} />} />
            <Card.Actions>
              <Button mode="contained" onPress={() => router.push(`/job/${jobId}/plan`)}>
                {t('job.reviewPlan')}
              </Button>
            </Card.Actions>
          </Card>
        ) : null}

        {healing && !done ? (
          <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Content style={styles.row}>
              <MaterialCommunityIcons name="bandage" size={20} color={theme.colors.primary} />
              <Text variant="bodyMedium" style={styles.flex}>
                {t('job.healing', { round: healing.round, before: healing.errorsBefore ?? '?', after: healing.errorsAfter ?? '?' })}
              </Text>
              {flags.elasticGenerationBudget ? (
                <Button compact mode="outlined" loading={busy === 'finalize'} disabled={!!busy} onPress={() => { track('deliver_as_is'); void act('finalize', () => aiApi.finalize(jobId)); }}>
                  {t('job.deliverAsIs')}
                </Button>
              ) : null}
            </Card.Content>
          </Card>
        ) : null}

        {endStatus === 'complete' ? (
          <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.border }]}>
            <Card.Content style={styles.result}>
              <View style={styles.row} accessibilityLiveRegion="polite">
                <MaterialCommunityIcons name="check-circle" size={24} color={theme.colors.success} />
                <View style={styles.flex}>
                  <Text variant="titleMedium" accessibilityRole="header">
                    {t('job.successTitle')}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                    {`${fileCount} ${fileCount === 1 ? 'file' : 'files'} · built in ${formatDuration(elapsed)}`}
                  </Text>
                </View>
              </View>
              <Button mode="contained" icon="rocket-launch-outline" contentStyle={styles.btn} onPress={() => projectId && router.push(`/project/${projectId}/deploy`)} disabled={!projectId}>
                {t('job.deploy')}
              </Button>
              <View style={styles.secondary}>
                <Button mode="outlined" icon="eye-outline" textColor={theme.colors.onSurface} style={[styles.half, stackActions && styles.full, { borderColor: theme.colors.border }]} onPress={() => projectId && router.push(`/project/${projectId}/preview`)} disabled={!projectId}>
                  {t('job.preview')}
                </Button>
                <Button mode="outlined" icon="chat-outline" textColor={theme.colors.onSurface} style={[styles.half, stackActions && styles.full, { borderColor: theme.colors.border }]} onPress={() => projectId && router.push(`/project/${projectId}/chat`)} disabled={!projectId}>
                  {t('job.chat')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {endStatus === 'partial' ? (
          <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.border }]}>
            <Card.Content style={styles.result}>
              <View style={styles.row} accessibilityLiveRegion="polite">
                <MaterialCommunityIcons name="alert-circle" size={24} color={theme.colors.warning} />
                <View style={styles.flex}>
                  <Text variant="titleMedium" accessibilityRole="header">
                    {t('job.partialTitle')}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                    {`${fileCount} ${fileCount === 1 ? 'file' : 'files'} · some checks didn’t pass. Repair fixes what it can.`}
                  </Text>
                </View>
              </View>
              {state.blockers?.length ? (
                <View style={styles.gap}>
                  {state.blockers.slice(0, 5).map((b) => (
                    <Text key={b} variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                      • {b}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Button mode="contained" icon="wrench-outline" contentStyle={styles.btn} loading={busy === 'repair'} disabled={!!busy} onPress={() => act('repair', () => aiApi.repair(jobId))}>
                {t('job.repair')}
              </Button>
              <View style={styles.secondary}>
                <Button mode="outlined" icon="folder-open-outline" textColor={theme.colors.onSurface} style={[styles.half, stackActions && styles.full, { borderColor: theme.colors.border }]} onPress={() => projectId && router.push(`/project/${projectId}`)} disabled={!projectId}>
                  Open project
                </Button>
                <Button mode="outlined" icon="refresh" textColor={theme.colors.onSurface} style={[styles.half, stackActions && styles.full, { borderColor: theme.colors.border }]} loading={busy === 'retry'} disabled={!!busy} onPress={() => act('retry', () => aiApi.retry(jobId))}>
                  {t('common.retry')}
                </Button>
              </View>
            </Card.Content>
          </Card>
        ) : null}
            <Card.Actions style={styles.wrapActions}>
              <Button onPress={() => projectId && router.push(`/project/${projectId}`)} disabled={!projectId}>
                Open project
              </Button>
              <Button icon="refresh" loading={busy === 'retry'} disabled={!!busy} onPress={() => act('retry', () => aiApi.retry(jobId))}>
                {t('common.retry')}
              </Button>
              <Button mode="contained" icon="wrench-outline" loading={busy === 'repair'} disabled={!!busy} onPress={() => act('repair', () => aiApi.repair(jobId))}>
                {t('job.repair')}
              </Button>
            </Card.Actions>
          </Card>
        ) : null}

        {endStatus === 'failed' ? (
          <Card mode="contained" style={{ backgroundColor: theme.colors.errorContainer }}>
            <Card.Title title={t('job.failedTitle')} subtitle={state.error ?? job.data?.error} subtitleNumberOfLines={4} left={(p) => <MaterialCommunityIcons name="close-circle" size={p.size} color={theme.colors.error} />} />
            <Card.Actions style={styles.wrapActions}>
              <Button icon="email-outline" onPress={() => Linking.openURL(supportMailto(userId))}>
                {t('job.report')}
              </Button>
              <Button mode="contained" icon="refresh" loading={busy === 'retry'} disabled={!!busy} onPress={() => act('retry', () => aiApi.retry(jobId))}>
                {t('common.retry')}
              </Button>
            </Card.Actions>
          </Card>
        ) : null}

        {state.tokenLimitHit ? (
          <Text variant="bodySmall" style={{ color: theme.colors.warning }}>
            The model hit its output limit; some files may be shorter than expected.
          </Text>
        ) : null}

        {readiness && readiness.ready === false && Array.isArray(readiness.reasons) ? (
          <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Title title="Preview not ready yet" left={(p) => <MaterialCommunityIcons name="eye-off-outline" size={p.size} color={theme.colors.textMuted} />} />
            <Card.Content>
              {(readiness.reasons as unknown[]).map((r, i) => (
                <Text key={i} variant="bodySmall">
                  • {String(r)}
                </Text>
              ))}
            </Card.Content>
          </Card>
        ) : null}

        {reports.length ? (
          <List.Section title={t('job.reports')} style={styles.section}>
            {reports.map(([type, data]) => (
              <List.Accordion key={type} title={REPORT_LABELS[type] ?? type} left={(p) => <List.Icon {...p} icon="clipboard-text-outline" />}>
                <Text variant="bodySmall" style={[styles.report, { color: theme.colors.textMuted }]} selectable>
                  {summarize(data)}
                </Text>
              </List.Accordion>
            ))}
          </List.Section>
        ) : null}

        <View style={styles.row}>
          <Text variant="titleMedium" style={styles.flex}>
            {t('job.files')}
          </Text>
          <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
            {fileCount}
          </Text>
        </View>
        {state.files.length === 0 && done && projectId ? (
          <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Content style={styles.gap}>
              <Text variant="bodyMedium">
                {fileCount ? `This app has ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.` : 'This generation has finished.'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                The live file stream is only kept while a build runs. Browse the project for its current files.
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button mode="outlined" icon="file-tree-outline" textColor={theme.colors.onSurface} style={{ borderColor: theme.colors.border }} onPress={() => router.push(`/project/${projectId}/files`)}>
                Browse files
              </Button>
            </Card.Actions>
          </Card>
        ) : state.files.length === 0 ? (
          <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
            Files appear here as they’re written.
          </Text>
        ) : null}
        {state.files.slice(0, 200).map((f) => (
          <Animated.View key={f.path} entering={reduceMotion ? undefined : FadeInDown.duration(220)} layout={reduceMotion ? undefined : LinearTransition}>
            <List.Item
              title={f.path}
              titleNumberOfLines={1}
              titleStyle={styles.mono}
              description={formatBytes(f.size)}
              left={(p) => <List.Icon {...p} icon="file-code-outline" />}
              onPress={() => setPeek(f)}
              style={[styles.file, { borderColor: theme.colors.border }]}
              accessibilityHint="Peek at the file"
            />
          </Animated.View>
        ))}
      </Screen>

      <Portal>
        <Dialog visible={!!peek} onDismiss={() => setPeek(null)} style={styles.peek}>
          <Dialog.Title numberOfLines={1}>{peek?.path}</Dialog.Title>
          <Dialog.Content style={styles.peekContent}>
            {peek?.content ? (
              <CodeViewer code={peek.content} language={languageFromPath(peek.path)} />
            ) : (
              <Text variant="bodyMedium">The full file will be available in the project once generation finishes.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPeek(null)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel generation?"
        body="Files written so far will be kept, but the app won’t be finished."
        confirmLabel="Cancel generation"
        destructive
        onConfirm={async () => {
          await act('cancel', () => aiApi.cancel(jobId));
          setConfirmCancel(false);
        }}
        onDismiss={() => setConfirmCancel(false)}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10 },
  wrapActions: { flexWrap: 'wrap', gap: 4 },
  gap: { gap: 6 },
  card: { borderRadius: 12 },
  result: { gap: 14, paddingVertical: 4 },
  btn: { minHeight: 44 },
  // Side by side normally; stacked at large text sizes so labels don't truncate.
  secondary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  half: { flexGrow: 1, flexBasis: '40%' },
  full: { flexBasis: '100%' },
  section: { marginVertical: 0 },
  report: { paddingHorizontal: 16, paddingBottom: 12, fontFamily: 'monospace' },
  file: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 2 },
  mono: { fontFamily: 'monospace', fontSize: 13 },
  peek: { maxHeight: '85%' },
  peekContent: { height: 420, paddingHorizontal: 0 },
});
