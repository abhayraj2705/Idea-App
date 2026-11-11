import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Banner, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { Avatar } from '@/components/Avatar';
import { ProjectCard, RunningJobCard, TemplateCard } from '@/components/Cards';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuotaMeter } from '@/components/QuotaMeter';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { EmptyView } from '@/components/StateViews';
import { qk, useInvalidate, useJobs, useProjects, useQuota, useTemplates } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useDraft } from '@/stores/draft';
import { useSession } from '@/stores/session';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Looks like an input so the next step is obvious; opens the builder with the draft (if any) intact. */
function Composer({ draft }: { draft: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const hasDraft = !!draft.trim();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        router.push('/builder/idea');
      }}
      style={({ pressed }) => [
        styles.composer,
        { borderColor: hasDraft ? theme.colors.primary : theme.colors.border, backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.surface },
      ]}
      accessibilityRole="button"
      accessibilityLabel={hasDraft ? `${t('home.composerDraft')}: ${draft}` : t('home.newIdea')}
    >
      <View style={styles.flex}>
        {hasDraft ? (
          <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
            {t('home.composerDraft')}
          </Text>
        ) : null}
        <Text variant="bodyLarge" numberOfLines={2} style={{ color: hasDraft ? theme.colors.onSurface : theme.colors.textMuted }}>
          {hasDraft ? draft.trim() : t('home.composerPrompt')}
        </Text>
      </View>
      <View style={[styles.composerGo, { backgroundColor: theme.colors.primary }]}>
        <MaterialCommunityIcons name="arrow-right" size={20} color={theme.colors.onPrimary} />
      </View>
    </Pressable>
  );
}

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
  const projectCount = projects.data?.length ?? 0;
  const summary = projects.data
    ? [plural(projectCount, 'project', 'projects'), running.length ? `${running.length} building` : null].filter(Boolean).join(' · ')
    : ' ';

  return (
    <Screen edges={['top', 'bottom']} refreshing={refreshing} onRefresh={() => void invalidate(qk.quota, qk.jobs, ['projects'], qk.templates)}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="headlineSmall" accessibilityRole="header">
            {firstName ? t('home.greeting', { name: firstName }) : t('home.greetingFallback')}
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
            {summary}
          </Text>
        </View>
        <Avatar name={user?.name ?? user?.email} size={40} onPress={() => router.push('/profile')} accessibilityLabel="Profile" />
      </View>

      <OfflineBanner />

      {user?.emailVerified === false ? (
        <Banner
          visible
          icon="email-alert-outline"
          actions={[
            {
              label: resent ? 'Link sent' : 'Resend link',
              disabled: resent,
              onPress: () => {
                setResent(true);
                void authApi.resendVerification().catch(() => setResent(false));
              },
            },
          ]}
        >
          Verify your email so you don’t lose access to your projects.
        </Banner>
      ) : null}

      <View style={styles.hero}>
        <Composer draft={draft.prompt} />
        <QuotaMeter quota={quota.data} />
      </View>

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
          <EmptyView title={t('home.emptyTitle')} body={t('home.emptyBody')} />
        )}
      </Section>

      {templates.data?.length ? (
        <Section title={t('home.templates')} action={t('common.seeAll')} onAction={() => router.push('/templates')}>
          <FlatList
            horizontal
            data={templates.data.slice(0, 8)}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <TemplateCard template={item} width={200} />}
            ItemSeparatorComponent={Gap}
            showsHorizontalScrollIndicator={false}
            // Bleed to the screen edge so cards scroll under the gutter instead of being clipped by it.
            style={styles.bleed}
            contentContainerStyle={styles.bleedContent}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
  flex: { flex: 1, gap: 2 },
  hero: { gap: 12 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  composerGo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bleed: { marginHorizontal: -16 },
  bleedContent: { paddingHorizontal: 16 },
  gap: { width: 12 },
});
