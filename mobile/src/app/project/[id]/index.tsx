import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Card, List, Snackbar, Switch, Text, TouchableRipple } from 'react-native-paper';

import { errorMessage, projectsApi, type Project } from '@/api';
import { kindIcon } from '@/components/Cards';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView, type IconName } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { shareProjectZip } from '@/features/project/share';
import { qk, useProject } from '@/features/queries';
import { config } from '@/lib/config';
import { timeAgo } from '@/lib/format';
import { useFeatures, useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

function Action({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useAppTheme();
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      borderless
      style={[styles.action, { backgroundColor: theme.colors.surfaceVariant, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      <View style={styles.actionInner}>
        <MaterialCommunityIcons name={icon} size={24} color={theme.colors.primary} />
        <Text variant="labelMedium" numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

export default function ProjectOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const flags = useFeatures();
  const guest = useSession((s) => s.status === 'guest');
  const project = useProject(id);
  const [sharing, setSharing] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  if (project.isLoading) return <LoadingView />;
  if (project.isError && !project.data) return <ErrorView error={project.error} onRetry={() => project.refetch()} />;
  const p = project.data;
  if (!p) return null;

  const go = (path: string) => router.push(`/project/${id}/${path}` as Href);

  const toggle = async (field: 'isPublic' | 'teamShared', value: boolean) => {
    qc.setQueryData<Project>(qk.project(id), (old) => (old ? { ...old, [field]: value } : old));
    try {
      if (field === 'isPublic') await projectsApi.setPublic(id, value);
      else await projectsApi.setTeamShared(id, value);
      void qc.invalidateQueries({ queryKey: ['projects'] });
    } catch (e) {
      qc.setQueryData<Project>(qk.project(id), (old) => (old ? { ...old, [field]: !value } : old));
      setSnack(errorMessage(e));
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      await shareProjectZip(id, p.name);
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: p.name }} />
      <Screen refreshing={project.isRefetching} onRefresh={() => project.refetch()}>
        <OfflineBanner />
        {guest ? (
          <Banner visible icon="account-plus-outline" actions={[{ label: 'Create account', onPress: () => useSession.getState().exitGuest() }]}>
            Create a free account to keep this project and keep building.
          </Banner>
        ) : null}
        <View style={styles.header}>
          <View style={[styles.bigIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name={kindIcon(p.kind)} size={28} color={theme.colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="titleLarge">{p.name}</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
              {[p.stack, p.fileCount != null ? `${p.fileCount} files` : null, p.updatedAt ? `Updated ${timeAgo(p.updatedAt)}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {p.status ? <StatusChip status={p.status} /> : null}
        </View>
        {p.description ? <Text variant="bodyMedium">{p.description}</Text> : null}

        <Card mode="contained" onPress={() => go('preview')} accessibilityLabel="Open preview">
          <Card.Content style={styles.previewCard}>
            <MaterialCommunityIcons name={p.kind === 'mobile' ? 'cellphone-play' : 'monitor-eye'} size={36} color={theme.colors.primary} />
            <View style={styles.flex}>
              <Text variant="titleMedium">Preview</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                {p.previewReadiness && !p.previewReadiness.ready
                  ? 'Not ready yet — tap to see why'
                  : p.kind === 'mobile'
                    ? 'Open in Expo Go or view the web build'
                    : 'Open the live app'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.textMuted} />
          </Card.Content>
        </Card>

        {/* Primary actions get full-width buttons; the four secondary tools form one even row. */}
        <Button mode="contained" icon="rocket-launch-outline" onPress={() => go('deploy')} disabled={guest} contentStyle={styles.primaryBtn}>
          Deploy
        </Button>
        {p.kind === 'mobile' && flags.mobileBuild ? (
          <Button mode="outlined" icon="android" onPress={() => go('android-build')} disabled={guest} contentStyle={styles.primaryBtn}>
            Build Android APK
          </Button>
        ) : null}

        <View style={styles.grid}>
          <Action icon="chat-processing-outline" label="Chat" onPress={() => go('chat')} />
          <Action icon="file-tree-outline" label="Files" onPress={() => go('files')} />
          <Action icon="history" label="History" onPress={() => go('history')} disabled={!flags.conversationThread} />
          <Action icon="share-variant-outline" label={sharing ? 'Preparing…' : 'Share'} onPress={share} disabled={sharing} />
        </View>

        {!guest ? (
          <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
            <List.Item
              title="Shared with team"
              description="Teammates can view and edit"
              left={(pp) => <List.Icon {...pp} icon="account-group-outline" />}
              right={() => <Switch value={!!p.teamShared} onValueChange={(v) => toggle('teamShared', v)} />}
            />
            <List.Item
              title="Public link"
              description="Anyone with the link can view"
              left={(pp) => <List.Icon {...pp} icon="earth" />}
              right={() => <Switch value={!!p.isPublic} onValueChange={(v) => toggle('isPublic', v)} />}
            />
          </Card>
        ) : null}

        <Button mode="text" icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(`${config.webUrl}/projects/${id}`)}>
          Open on web (design canvas, full editor)
        </Button>
      </Screen>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  previewCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grid: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, borderRadius: 14, minHeight: 76 },
  primaryBtn: { minHeight: 48 },
  actionInner: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 4 },
});
