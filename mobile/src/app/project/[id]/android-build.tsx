import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, HelperText, List, Portal, Text } from 'react-native-paper';

import { errorMessage, mobileBuildApi, type MobileBuild } from '@/api';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { qk, useBuilds, useReadiness } from '@/features/queries';
import { track } from '@/lib/analytics';
import { timeAgo } from '@/lib/format';
import { useFeatures } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

/**
 * Readiness → build → install (§5.5, behind `mobileBuild`).
 *
 * Google Play policy: this app does NOT request REQUEST_INSTALL_PACKAGES. "Install on
 * this phone" hands the APK URL to the system browser, which owns the download and
 * the "install unknown apps" consent. The IDEA app never downloads or runs executable
 * code itself (Apple 2.5.2 / Play Device and Network Abuse).
 */
export default function AndroidBuild() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const flags = useFeatures();
  const readiness = useReadiness(id);
  const builds = useBuilds(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installFor, setInstallFor] = useState<MobileBuild | null>(null);

  if (!flags.mobileBuild) return <EmptyView icon="android" title="Android builds aren’t available yet" />;
  if (readiness.isLoading) return <LoadingView />;
  if (readiness.isError) return <ErrorView error={readiness.error} onRetry={() => readiness.refetch()} />;

  const list = [...(builds.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const running = list.some((b) => b.status === 'queued' || b.status === 'building');

  const run = async (name: string, fn: () => Promise<unknown>) => {
    setBusy(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen refreshing={builds.isRefetching || readiness.isRefetching} onRefresh={() => { void builds.refetch(); void readiness.refetch(); }}>
      <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
        <Card.Title title="Build readiness" right={() => <View style={styles.pr}><StatusChip status={readiness.data?.ready ? 'complete' : 'partial'} label={readiness.data?.ready ? 'Ready' : 'Needs fixes'} /></View>} />
        {readiness.data?.checks.map((c) => (
          <List.Item
            key={c.id}
            title={c.label}
            description={c.detail}
            left={(p) => <List.Icon {...p} icon={c.ok ? 'check-circle-outline' : 'alert-circle-outline'} color={c.ok ? theme.colors.success : theme.colors.warning} />}
          />
        ))}
        {!readiness.data?.ready ? (
          <Card.Actions>
            <Button
              icon="wrench-outline"
              loading={busy === 'repair'}
              disabled={!!busy}
              onPress={() =>
                run('repair', async () => {
                  qc.setQueryData(qk.readiness(id), await mobileBuildApi.repair(id));
                })
              }
            >
              Fix automatically
            </Button>
          </Card.Actions>
        ) : null}
      </Card>

      <Button
        mode="contained"
        icon="android"
        disabled={!readiness.data?.ready || running || !!busy}
        loading={busy === 'build'}
        onPress={() =>
          run('build', async () => {
            await mobileBuildApi.startBuild(id);
            track('apk_build_started');
            await qc.invalidateQueries({ queryKey: qk.builds(id) });
          })
        }
      >
        {running ? 'Build in progress…' : 'Build Android APK'}
      </Button>
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}

      <Text variant="titleMedium">Builds</Text>
      {list.length === 0 ? <Text style={{ color: theme.colors.textMuted }}>No builds yet. Builds take about 10–20 minutes; we’ll notify you.</Text> : null}
      {list.map((b) => (
        <Card key={b.id} mode="outlined" style={{ borderColor: theme.colors.border }}>
          <Card.Title title={`Build ${b.id.slice(-6)}`} subtitle={timeAgo(b.createdAt)} right={() => <View style={styles.pr}><StatusChip status={b.status} /></View>} />
          {b.error ? (
            <Card.Content>
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {b.error}
              </Text>
            </Card.Content>
          ) : null}
          {b.status === 'succeeded' && b.artifactUrl ? (
            <Card.Actions>
              {Platform.OS === 'android' ? (
                <Button mode="contained" icon="download" onPress={() => setInstallFor(b)}>
                  Install on this phone
                </Button>
              ) : (
                <Button icon="share-variant-outline" onPress={() => Share.share({ message: `Android build ready: ${b.artifactUrl}` })}>
                  Share build link
                </Button>
              )}
            </Card.Actions>
          ) : null}
          {b.logsUrl ? (
            <Card.Actions>
              <Button compact icon="text-box-outline" onPress={() => WebBrowser.openBrowserAsync(b.logsUrl!)}>
                Logs
              </Button>
            </Card.Actions>
          ) : null}
        </Card>
      ))}

      <Portal>
        <Dialog visible={!!installFor} onDismiss={() => setInstallFor(null)}>
          <Dialog.Icon icon="android" />
          <Dialog.Title style={styles.center}>Install the APK</Dialog.Title>
          <Dialog.Content style={styles.gap}>
            <Text variant="bodyMedium">The APK will download in your browser. Android will then ask you to allow installing apps from that browser — that’s expected for test builds.</Text>
            <View style={styles.row}>
              <MaterialCommunityIcons name="shield-check-outline" size={18} color={theme.colors.success} />
              <Text variant="bodySmall" style={styles.flex}>
                This is your own app, built from your project.
              </Text>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setInstallFor(null)}>Cancel</Button>
            <Button
              onPress={() => {
                const url = installFor?.artifactUrl;
                setInstallFor(null);
                if (url && /^https:\/\//i.test(url)) void Linking.openURL(url);
              }}
            >
              Download
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pr: { paddingRight: 12 },
  center: { textAlign: 'center' },
  gap: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
