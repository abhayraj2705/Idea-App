import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Banner, Divider, List, Snackbar, Switch } from 'react-native-paper';

import { errorMessage, notificationsApi, type NotificationPreferences } from '@/api';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { registerForPush } from '@/features/notifications/push';
import { qk, useNotificationPrefs } from '@/features/queries';

const ROWS: { key: keyof NotificationPreferences; title: string; description: string; icon: string }[] = [
  { key: 'generation', title: 'Generation finished', description: 'Ready, finished with issues or failed', icon: 'progress-check' },
  { key: 'planReady', title: 'Plan ready for review', description: 'When a plan needs your approval', icon: 'clipboard-check-outline' },
  { key: 'builds', title: 'Android builds', description: 'When an APK build finishes', icon: 'android' },
  { key: 'deploys', title: 'Deploys', description: 'When a deploy goes live or fails', icon: 'rocket-launch-outline' },
  { key: 'teamInvites', title: 'Team invites', description: 'When someone invites you to a team', icon: 'account-group-outline' },
];

export default function NotificationSettings() {
  const qc = useQueryClient();
  const prefs = useNotificationPrefs();
  const [permission, setPermission] = useState<string>('undetermined');
  const [snack, setSnack] = useState<string | null>(null);

  const checkPermission = () => {
    if (Platform.OS === 'web') return;
    void Notifications.getPermissionsAsync().then((p) => setPermission(p.status));
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void Notifications.getPermissionsAsync().then((p) => setPermission(p.status));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void Notifications.getPermissionsAsync().then((p) => setPermission(p.status));
    });
    return () => sub.remove();
  }, []);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    const prev = prefs.data;
    qc.setQueryData(qk.notificationPrefs, { ...prev, [key]: value });
    try {
      qc.setQueryData(qk.notificationPrefs, await notificationsApi.updatePreferences({ [key]: value }));
    } catch (e) {
      qc.setQueryData(qk.notificationPrefs, prev);
      setSnack(errorMessage(e));
    }
  };

  if (prefs.isLoading) return <LoadingView />;
  if (prefs.isError) return <ErrorView error={prefs.error} onRetry={() => prefs.refetch()} />;

  return (
    <Screen padded={false}>
      <Banner
        visible={permission !== 'granted' && Platform.OS !== 'web'}
        icon="bell-off-outline"
        actions={[
          permission === 'denied'
            ? { label: 'Open settings', onPress: () => void Linking.openSettings() }
            : { label: 'Turn on', onPress: async () => { await registerForPush({ prompt: true }); void checkPermission(); } },
        ]}
      >
        Notifications are off for IDEA on this device. Turn them on to hear when your app is ready.
      </Banner>
      <List.Section>
        {ROWS.map((r, i) => (
          <List.Item
            key={r.key}
            title={r.title}
            description={r.description}
            left={(p) => <List.Icon {...p} icon={r.icon} />}
            right={() => <Switch value={!!prefs.data?.[r.key]} onValueChange={(v) => toggle(r.key, v)} />}
            style={i < ROWS.length - 1 ? undefined : undefined}
          />
        ))}
      </List.Section>
      <Divider />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}
