import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, RadioButton, Text, TouchableRipple } from 'react-native-paper';

import { deployApi, errorMessage, type DeployPlan } from '@/api';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { Timeline } from '@/components/Timeline';
import { AuthCancelled, connectProvider } from '@/features/auth/socialAuth';
import { qk, useDeployProviders, useDeployments } from '@/features/queries';
import { track } from '@/lib/analytics';
import { timeAgo } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme/theme';

const PROVIDER_ICON: Record<string, 'triangle-outline' | 'train' | 'github'> = { vercel: 'triangle-outline', railway: 'train', github: 'github' };

/** Plan → launch → status timeline (§7.7). Polls every 5 s while visible, then relies on push. */
export default function DeployScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const providers = useDeployProviders();
  const deployments = useDeployments(id);
  const [provider, setProvider] = useState<string | null>(null);
  const [plan, setPlan] = useState<DeployPlan | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const latest = [...(deployments.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0];
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (latest?.status === 'succeeded' && announced.current !== latest.id) {
      announced.current = latest.id;
      track('deploy_succeeded', { provider: latest.provider });
      haptics.success();
    }
  }, [latest?.status, latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async (pid: string) => {
    setBusy(`connect:${pid}`);
    setError(null);
    try {
      await connectProvider(pid);
      await qc.invalidateQueries({ queryKey: qk.deployProviders });
      await qc.invalidateQueries({ queryKey: qk.connections });
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const preview = async () => {
    if (!provider) return;
    setBusy('plan');
    setError(null);
    try {
      setPlan(await deployApi.previewPlan(id, provider));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const launch = async () => {
    if (!plan) return;
    setBusy('launch');
    setError(null);
    try {
      await deployApi.launch(plan.id);
      track('deploy_launched', { provider: plan.provider });
      setPlan(null);
      await qc.invalidateQueries({ queryKey: qk.deployments(id) });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (providers.isLoading) return <LoadingView />;
  if (providers.isError) return <ErrorView error={providers.error} onRetry={() => providers.refetch()} />;

  return (
    <Screen refreshing={deployments.isRefetching} onRefresh={() => deployments.refetch()}>
      {latest ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          <Card.Title
            title={`Latest deploy · ${latest.provider}`}
            subtitle={timeAgo(latest.createdAt)}
            right={() => (
              <View style={styles.pr}>
                <StatusChip status={latest.status} />
              </View>
            )}
          />
          <Card.Content>
            <Timeline items={(latest.steps ?? []).map((s) => ({ ...s }))} />
            {latest.url ? (
              <Button mode="contained" icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(latest.url!)}>
                Live at {latest.url.replace(/^https?:\/\//, '')}
              </Button>
            ) : null}
          </Card.Content>
        </Card>
      ) : null}

      <Text variant="titleMedium">{plan ? 'Review the plan' : 'Deploy to'}</Text>

      {!plan ? (
        <RadioButton.Group value={provider ?? ''} onValueChange={setProvider}>
          {(providers.data ?? []).map((p) => (
            <TouchableRipple
              key={p.id}
              onPress={() => (p.connected ? setProvider(p.id) : connect(p.id))}
              style={[styles.provider, { borderColor: provider === p.id ? theme.colors.primary : theme.colors.border }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: provider === p.id }}
              borderless
            >
              <View style={styles.row}>
                <MaterialCommunityIcons name={PROVIDER_ICON[p.id] ?? 'cloud-upload-outline'} size={24} color={theme.colors.onSurface} />
                <View style={styles.flex}>
                  <Text variant="titleSmall">{p.name}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                    {p.connected ? 'Connected' : 'Tap to connect'}
                  </Text>
                </View>
                {p.connected ? (
                  <RadioButton value={p.id} />
                ) : (
                  <Button compact loading={busy === `connect:${p.id}`} disabled={!!busy} onPress={() => connect(p.id)}>
                    Connect
                  </Button>
                )}
              </View>
            </TouchableRipple>
          ))}
        </RadioButton.Group>
      ) : (
        <Card mode="contained">
          <Card.Content>
            <Timeline items={plan.steps.map((s) => ({ ...s, status: s.status ?? 'pending' }))} />
          </Card.Content>
        </Card>
      )}

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      {plan ? (
        <View style={styles.gap}>
          <Button mode="contained" icon="rocket-launch" onPress={launch} loading={busy === 'launch'} disabled={!!busy}>
            Launch
          </Button>
          <Button onPress={() => setPlan(null)} disabled={!!busy}>
            Back
          </Button>
        </View>
      ) : (
        <Button mode="contained" icon="clipboard-list-outline" onPress={preview} loading={busy === 'plan'} disabled={!provider || !!busy}>
          Preview deploy plan
        </Button>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pr: { paddingRight: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  provider: { borderWidth: 1.5, borderRadius: 14, padding: 12, marginBottom: 10 },
  gap: { gap: 8 },
});
