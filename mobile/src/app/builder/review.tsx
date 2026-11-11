import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, HelperText, List, Menu, Text } from 'react-native-paper';

import { errorMessage } from '@/api/client';
import { aiApi } from '@/api/endpoints/ai';
import { BrandArrowIcon } from '@/components/brand/Logo';
import { OfflineBanner, useIsOffline } from '@/components/OfflineBanner';
import { isQuotaExhausted, QuotaMeter } from '@/components/QuotaMeter';
import { FormAlert } from '@/features/auth/AuthLayout';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { isUsableProvider, useAiModel } from '@/features/builder/useAiModel';
import { startGeneration } from '@/features/generation/startGeneration';
import { maybeAskAfterFirstGeneration } from '@/features/notifications/push';
import { qk, useCapabilities, useProviders, useQuota } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { uuid } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { secureStore } from '@/lib/secureStore';
import { useDraft } from '@/stores/draft';
import { useFeatures, useSession } from '@/stores/session';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

export default function ReviewStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const { draft, update, reset } = useDraft();
  const flags = useFeatures();
  const apiKeys = useSession((s) => s.user?.apiKeys);
  const keys = apiKeys?.map((k) => k.provider) ?? [];
  const offline = useIsOffline();
  const quota = useQuota();
  const providers = useProviders();
  const caps = useCapabilities();
  const ai = useAiModel();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const doc = draft.requirementsDoc;
  const estimate = useQuery({
    queryKey: ['estimate', draft.prompt, doc?.compiledSummary, ai.provider, ai.model],
    queryFn: () => aiApi.estimate({ userPrompt: draft.prompt, requirements: doc, ...ai }),
    enabled: !!doc,
  });

  // Models the user can actually run: platform-provided ones, plus providers they've added a key for.
  const models = (providers.data ?? [])
    .filter((p) => isUsableProvider(p, keys))
    .flatMap((p) => p.models.map((m) => ({ ...m, provider: p.id, providerName: p.name })));
  const selected = models.find((m) => m.provider === ai.provider && m.id === ai.model);
  const stack = caps.data?.stacks.find((s) => s.id === draft.stack);
  const exhausted = isQuotaExhausted(quota.data);
  const needsWireframe = flags.wireframeGate && !draft.wireframeApproved;

  const generate = async () => {
    if (inFlight.current || !doc) return; // double-tap guard; the server also dedups by Idempotency-Key
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await startGeneration(
        {
          userPrompt: draft.prompt.trim(),
          projectName: draft.projectName?.trim() || doc.projectName,
          stackId: draft.stack,
          provider: ai.provider,
          model: ai.model,
          requirements: draft.wireframe?.raw ? { ...doc, approvedWireframe: draft.wireframe.raw } : doc,
          designImage: draft.designImage,
        },
        uuid(), // one key per tap (§7.2)
      );
      if (res.guestToken) await secureStore.setGuestToken(res.guestToken);
      track('generation_started', { stack: draft.stack, mode: res.mode });
      haptics.success();
      reset();
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: qk.quota });
      router.dismissAll();
      router.push(`/job/${res.jobId}`);
      void maybeAskAfterFirstGeneration();
    } catch (e) {
      haptics.error();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  const summary = doc?.compiledSummary || draft.prompt;

  return (
    <BuilderScaffold
      step="review"
      title={t('builder.reviewTitle')}
      nextLabel={busy ? t('builder.starting') : t('builder.generate')}
      nextLoading={busy}
      nextDisabled={exhausted || offline || !draft.stack || !doc || needsWireframe}
      onNext={async () => {
        await generate();
        return false;
      }}
      footerExtra={error ? <FormAlert message={error} /> : null}
    >
      <OfflineBanner message={t('builder.offlineDraft')} />
      <QuotaMeter quota={quota.data} />

      <Card mode="outlined" style={[styles.card, { borderColor: theme.colors.border }]}>
        <List.Item
          title={draft.projectName || doc?.projectName || t('builder.untitled')}
          description={summary}
          descriptionNumberOfLines={4}
          left={(p) => <List.Icon {...p} icon={BrandArrowIcon} />}
          onPress={() => router.navigate('/builder/idea')}
        />
        <List.Item
          title={stack?.name ?? draft.stack ?? t('builder.noStack')}
          left={(p) => <List.Icon {...p} icon="layers-outline" />}
          onPress={() => router.navigate('/builder/stack')}
        />
        <List.Item
          title={doc ? t('builder.featuresCount', { count: draft.requirements.length }) : t('builder.questionsPending')}
          description={draft.requirements.slice(0, 3).map((r) => r.title).join(' · ') || undefined}
          descriptionNumberOfLines={2}
          left={(p) => <List.Icon {...p} icon="format-list-checks" />}
          onPress={() => router.navigate('/builder/requirements')}
        />
        {flags.wireframeGate ? (
          <List.Item
            title={draft.wireframeApproved ? t('builder.wireframeApproved', { count: draft.wireframe?.screens.length ?? 0 }) : t('builder.wireframePending')}
            left={(p) => <List.Icon {...p} icon={draft.wireframeApproved ? 'check-circle-outline' : 'alert-circle-outline'} />}
            onPress={() => router.navigate('/builder/wireframe')}
          />
        ) : null}
        {models.length ? (
          <Menu
            visible={menu}
            onDismiss={() => setMenu(false)}
            anchor={
              <List.Item
                title={selected?.name ?? t('builder.defaultModel')}
                description={selected?.providerName}
                left={(p) => <List.Icon {...p} icon="robot-outline" />}
                right={(p) => <List.Icon {...p} icon="menu-down" />}
                onPress={() => setMenu(true)}
              />
            }
          >
            {models.map((m) => (
              <Menu.Item
                key={`${m.provider}:${m.id}`}
                title={`${m.name} · ${m.providerName}`}
                leadingIcon={m.provider === ai.provider && m.id === ai.model ? 'check' : undefined}
                onPress={() => {
                  update({ provider: m.provider, model: m.id });
                  setMenu(false);
                }}
              />
            ))}
          </Menu>
        ) : null}
      </Card>

      <View style={[styles.estimate, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="labelLarge" style={{ color: theme.colors.textMuted }}>
          {t('builder.estimateLabel')}
        </Text>
        <Text variant="titleMedium">
          {estimate.data
            ? t('builder.estimate', { tokens: estimate.data.tokens.toLocaleString() }) + (estimate.data.risk ? ` · ${t('builder.risk', { risk: estimate.data.risk })}` : '')
            : estimate.isLoading
              ? t('builder.calculating')
              : t('builder.unavailable')}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
          {t('builder.runsOnServer')}
        </Text>
      </View>

      {!doc ? (
        <HelperText type="info" visible style={{ color: theme.colors.textMuted }}>
          {t('builder.answerFirst')}
        </HelperText>
      ) : needsWireframe ? (
        <HelperText type="info" visible style={{ color: theme.colors.textMuted }}>
          {t('builder.approveWireframeFirst')}
        </HelperText>
      ) : null}
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.control },
  estimate: { gap: 4, padding: 16, borderRadius: radius.control },
});
