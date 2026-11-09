import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Card, HelperText, List, Menu, Text } from 'react-native-paper';

import { aiApi } from '@/api/endpoints/ai';
import { ApiError, errorMessage } from '@/api/client';
import { BrandArrowIcon } from '@/components/brand/Logo';
import { isQuotaExhausted, QuotaMeter } from '@/components/QuotaMeter';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { maybeAskAfterFirstGeneration } from '@/features/notifications/push';
import { qk, useCapabilities, useProviders, useQuota } from '@/features/queries';
import { useIsOffline } from '@/components/OfflineBanner';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { uuid } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { secureStore } from '@/lib/secureStore';
import { useDraft } from '@/stores/draft';
import { useFeatures, useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function ReviewStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const { draft, update, reset } = useDraft();
  const flags = useFeatures();
  const user = useSession((s) => s.user);
  const offline = useIsOffline();
  const quota = useQuota();
  const providers = useProviders();
  const caps = useCapabilities();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const estimate = useQuery({
    queryKey: ['estimate', draft.stack, draft.scope, draft.requirements.length, draft.model],
    queryFn: () => aiApi.estimate({ prompt: draft.prompt, stack: draft.stack, scope: draft.scope, requirements: draft.requirements, model: draft.model }),
  });

  const models = (providers.data ?? []).flatMap((p) => p.models.map((m) => ({ ...m, provider: p.name })));
  const model = models.find((m) => m.id === draft.model) ?? models.find((m) => m.default) ?? models[0];
  const stack = caps.data?.stacks.find((s) => s.id === draft.stack);
  const exhausted = isQuotaExhausted(quota.data);
  const byoKey = (user?.apiKeys?.length ?? 0) > 0;
  const needsWireframe = flags.wireframeGate && !draft.wireframeApproved;

  const generate = async () => {
    if (inFlight.current) return; // double-tap guard; server also dedups by Idempotency-Key
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await aiApi.generate(
        {
          prompt: draft.prompt,
          stack: draft.stack!,
          scope: flags.generationScope ? draft.scope : undefined,
          model: model?.id,
          requirements: draft.requirements,
          wireframeId: draft.wireframe?.id,
          projectName: draft.projectName,
          designImage: draft.designImage,
        },
        uuid(), // one key per tap (§7.2)
      );
      if (res.guestToken) await secureStore.setGuestToken(res.guestToken);
      track('generation_started', { stack: draft.stack, scope: draft.scope });
      haptics.success();
      reset();
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: qk.quota });
      router.dismissAll();
      router.push(`/job/${res.jobId}`);
      void maybeAskAfterFirstGeneration();
    } catch (e) {
      haptics.error();
      setError(e instanceof ApiError && e.isRateLimited ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  };

  return (
    <BuilderScaffold
      step="review"
      title={t('builder.reviewTitle')}
      nextLabel={t('builder.generate')}
      nextLoading={busy}
      nextDisabled={exhausted || offline || !draft.stack || needsWireframe}
      onNext={async () => {
        await generate();
        return false;
      }}
    >
      {offline ? <Banner visible icon="wifi-off">{t('builder.offlineDraft')}</Banner> : null}
      <QuotaMeter quota={quota.data} />
      <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
        <List.Item title={draft.projectName || 'Untitled app'} description={draft.prompt} descriptionNumberOfLines={3} left={(p) => <List.Icon {...p} icon={BrandArrowIcon} />} onPress={() => router.navigate('/builder/idea')} />
        <List.Item title={stack?.name ?? draft.stack ?? 'No stack'} description={flags.generationScope ? (draft.scope === 'website' ? 'Website only' : 'Full app') : undefined} left={(p) => <List.Icon {...p} icon="layers-outline" />} onPress={() => router.navigate('/builder/stack')} />
        <List.Item title={`${draft.requirements.length} requirements`} left={(p) => <List.Icon {...p} icon="format-list-checks" />} onPress={() => router.navigate('/builder/requirements')} />
        {flags.wireframeGate ? (
          <List.Item
            title={draft.wireframeApproved ? `Wireframe approved · ${draft.wireframe?.screens.length ?? 0} screens` : 'Wireframe not approved'}
            left={(p) => <List.Icon {...p} icon={draft.wireframeApproved ? 'check-circle-outline' : 'alert-circle-outline'} />}
            onPress={() => router.navigate('/builder/wireframe')}
          />
        ) : null}
        {models.length ? (
          <Menu
            visible={menu}
            onDismiss={() => setMenu(false)}
            anchor={<List.Item title={model ? `${model.name}` : 'Default model'} description={model?.provider} left={(p) => <List.Icon {...p} icon="robot-outline" />} right={(p) => <List.Icon {...p} icon="menu-down" />} onPress={() => setMenu(true)} />}
          >
            {models.map((m) => (
              <Menu.Item
                key={m.id}
                title={`${m.name} · ${m.provider}`}
                leadingIcon={m.id === model?.id ? 'check' : undefined}
                onPress={() => {
                  update({ model: m.id });
                  setMenu(false);
                }}
              />
            ))}
          </Menu>
        ) : null}
      </Card>

      <Card mode="contained">
        <Card.Content style={styles.estimate}>
          <Text variant="labelLarge">Estimate</Text>
          <Text variant="titleMedium">
            {estimate.data ? t('builder.estimate', { minutes: estimate.data.minutes, tokens: estimate.data.tokens.toLocaleString() }) : estimate.isLoading ? 'Calculating…' : 'Unavailable'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
            Generation runs on our servers. You can leave the app — we’ll notify you when it’s ready.
          </Text>
        </Card.Content>
      </Card>

      {byoKey ? (
        <HelperText type="info" visible>
          {t('builder.byoNotice')}
        </HelperText>
      ) : null}
      {needsWireframe ? (
        <HelperText type="error" visible>
          Approve the wireframe before generating.
        </HelperText>
      ) : null}
      {error ? (
        <View accessibilityLiveRegion="polite">
          <HelperText type="error" visible>
            {error}
          </HelperText>
        </View>
      ) : null}
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({ estimate: { gap: 4 } });
