import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Avatar, Banner, Button, Card, Text, TouchableRipple } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { ProjectCard, RunningJobCard, TemplateCard } from '@/components/Cards';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuotaMeter } from '@/components/QuotaMeter';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { EmptyView } from '@/components/StateViews';
import { qk, useInvalidate, useJobs, useProjects, useQuota, useTemplates } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { useDraft } from '@/stores/draft';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function Home() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const user = useSession((s) => s.user);
  const draft = useDraft((s) => s.draft);
  const quota = useQuota();
  const jobs = useJobs();
  const projects = useProjects('mine');
  const templates = useTemplates();
  const invalidate = useInvalidate();
  const [resent, setResent] = useState(false);

  const running = (jobs.data ?? []).filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'awaiting_plan_approval');
  const recent = (projects.data ?? []).slice(0, 5);
  const refreshing = quota.isRefetching || jobs.isRefetching || projects.isRefetching;
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen edges={['top', 'bottom']} refreshing={refreshing} onRefresh={() => void invalidate(qk.quota, qk.jobs, ['projects'], qk.templates)}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {firstName ? t('home.greeting', { name: firstName }) : 'Welcome'}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
            {t('auth.tagline')}
          </Text>
        </View>
        <TouchableRipple onPress={() => router.push('/profile')} borderless style={styles.avatar} accessibilityRole="button" accessibilityLabel="Profile">
          <Avatar.Text size={44} label={(user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()} />
        </TouchableRipple>
      </View>

      <OfflineBanner />

      {user && !user.emailVerified ? (
        <Banner
          visible
          icon="email-alert-outline"
          actions={[
            {
              label: resent ? 'Sent' : 'Resend link',
              disabled: resent,
              onPress: () => {
                setResent(true);
                void authApi.resendVerification().catch(() => setResent(false));
              },
            },
          ]}
        >
          Verify your email to keep your projects safe.
        </Banner>
      ) : null}

      <QuotaMeter quota={quota.data} />

      <Button mode="contained" icon="lightbulb-on-outline" onPress={() => router.push('/builder/idea')} contentStyle={styles.bigBtn} labelStyle={styles.bigLabel}>
        {t('home.newIdea')}
      </Button>

      {draft.prompt.trim() ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.primary }} onPress={() => router.push('/builder/idea')}>
          <Card.Title title="Continue your draft" subtitle={draft.prompt} subtitleNumberOfLines={2} left={(p) => <Avatar.Icon {...p} icon="file-document-edit-outline" />} />
        </Card>
      ) : null}

      {running.length ? (
        <Section title={t('home.running')}>
          {running.map((j) => (
            <RunningJobCard key={j.id} job={j} />
          ))}
        </Section>
      ) : null}

      <Section title={t('home.recent')} action={recent.length ? t('common.seeAll') : undefined} onAction={() => router.push('/projects')}>
        {recent.length ? (
          recent.map((p) => <ProjectCard key={p.id} project={p} />)
        ) : projects.isLoading ? null : (
          <EmptyView icon="lightbulb-on-outline" title={t('home.emptyTitle')} body={t('home.emptyBody')} />
        )}
      </Section>

      {templates.data?.length ? (
        <Section title={t('home.templates')} action={t('common.seeAll')} onAction={() => router.push('/templates')}>
          <FlatList
            horizontal
            data={templates.data.slice(0, 8)}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <TemplateCard template={item} width={200} />}
            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            showsHorizontalScrollIndicator={false}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  avatar: { borderRadius: 22 },
  bigBtn: { minHeight: 56 },
  bigLabel: { fontSize: 16 },
});
