import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useIsFocused } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, ProgressBar, Text } from 'react-native-paper';

import type { Job, ProjectSummary, Template } from '@/api/types';
import { STAGES, STAGE_LABEL } from '@/features/generation/eventReducer';
import { useJobStream } from '@/features/generation/useJobStream';
import { timeAgo } from '@/lib/format';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

import type { IconName } from './StateViews';
import { StatusChip } from './StatusChip';

export function kindIcon(kind?: string): IconName {
  if (kind === 'mobile') return 'cellphone';
  if (kind === 'web') return 'web';
  return 'application-braces-outline';
}

export const ProjectCard = memo(function ProjectCard({ project, onLongPress }: { project: ProjectSummary; onLongPress?: () => void }) {
  const theme = useAppTheme();
  return (
    <Card
      mode="outlined"
      style={[styles.card, { borderColor: theme.colors.border }]}
      onPress={() => router.push(`/project/${project.id}`)}
      onLongPress={onLongPress}
      accessibilityLabel={`Project ${project.name}`}
      accessibilityHint="Opens the project"
    >
      <Card.Content style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name={kindIcon(project.kind)} size={20} color={theme.colors.onSurface} />
        </View>
        <View style={styles.flex}>
          <Text variant="titleMedium" numberOfLines={2}>
            {project.name}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.textMuted }}>
            {[project.stack, timeAgo(project.updatedAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {project.status ? <StatusChip status={project.status} compact /> : null}
      </Card.Content>
    </Card>
  );
});

/** Running job card: subscribes to its stream only while the screen is focused (§7.1). */
export const RunningJobCard = memo(function RunningJobCard({ job }: { job: Job }) {
  const theme = useAppTheme();
  const focused = useIsFocused();
  const { state } = useJobStream(job.id, { enabled: focused });
  const idx = STAGES.indexOf(state.stage);
  const progress = state.endStatus ? 1 : Math.max(0.05, (idx + 0.5) / STAGES.length);
  return (
    <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.border }]} onPress={() => router.push(`/job/${job.id}`)} accessibilityLabel={`Generation ${job.projectName ?? ''}, stage ${STAGE_LABEL[state.stage]}`}>
      <Card.Content style={styles.gap}>
        <View style={styles.row}>
          <Text variant="titleSmall" numberOfLines={1} style={styles.flex}>
            {job.projectName ?? 'New app'}
          </Text>
          <StatusChip status={state.endStatus ?? state.status ?? job.status} compact />
        </View>
        <ProgressBar progress={progress} color={theme.colors.primary} style={styles.bar} />
        <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
          {state.phaseLabel || STAGE_LABEL[state.stage]} · {state.files.length} {state.files.length === 1 ? 'file' : 'files'}
        </Text>
      </Card.Content>
    </Card>
  );
});

/** Says what the timestamp on an activity row means, so it can't be confused with a project's "Updated" time. */
function jobWhen(job: Job): string | null {
  const running = job.status === 'running' || job.status === 'queued' || job.status === 'awaiting_plan_approval';
  const at = running ? job.createdAt : (job.finishedAt ?? job.updatedAt ?? job.createdAt);
  if (!at) return null;
  const verb = running ? 'Started' : job.status === 'failed' ? 'Failed' : job.status === 'cancelled' ? 'Cancelled' : 'Generated';
  return `${verb} ${timeAgo(at)}`;
}

export const JobRow = memo(function JobRow({ job }: { job: Job }) {
  const theme = useAppTheme();
  return (
    <Card
      mode="outlined"
      style={[styles.card, { borderColor: theme.colors.border }]}
      onPress={() => router.push(`/job/${job.id}`)}
      accessibilityLabel={`${job.projectName ?? 'Generation'}, ${jobWhen(job) ?? ''}`}
      accessibilityHint="Opens the generation"
    >
      <Card.Content style={styles.row}>
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="lightning-bolt-outline" size={20} color={theme.colors.onSurface} />
        </View>
        <View style={styles.flex}>
          <Text variant="titleSmall" numberOfLines={1}>
            {job.projectName ?? 'Generation'}
          </Text>
          <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.textMuted }}>
            {[job.stack, jobWhen(job)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <StatusChip status={job.status} compact />
      </Card.Content>
    </Card>
  );
});

export const TemplateCard = memo(function TemplateCard({ template, width }: { template: Template; width?: number }) {
  const theme = useAppTheme();
  return (
    <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.border }, width ? { width } : null]} onPress={() => router.push(`/templates/${template.id}`)}>
      <Card.Content style={styles.gap}>
        <View style={[styles.icon, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name={kindIcon(template.kind)} size={20} color={theme.colors.onSurface} />
        </View>
        <Text variant="titleSmall" numberOfLines={1}>
          {template.name}
        </Text>
        <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.colors.textMuted, minHeight: 32 }}>
          {template.description}
        </Text>
      </Card.Content>
    </Card>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gap: { gap: 8 },
  flex: { flex: 1 },
  card: { borderRadius: radius.control },
  icon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 4, borderRadius: 2 },
});
