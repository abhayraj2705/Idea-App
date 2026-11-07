import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Avatar, Divider, List, Text } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import type { IconName } from '@/components/StateViews';
import { useTranslation } from '@/i18n';
import { legalUrls } from '@/lib/config';
import { supportMailto } from '@/lib/support';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function Profile() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const [confirm, setConfirm] = useState(false);

  const item = (title: string, icon: IconName, href: Href, description?: string) => (
    <List.Item
      title={title}
      description={description}
      left={(p) => <List.Icon {...p} icon={icon} />}
      right={(p) => <List.Icon {...p} icon="chevron-right" />}
      onPress={() => router.push(href)}
      accessibilityRole="button"
    />
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Avatar.Text size={64} label={(user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()} />
        <View style={styles.flex}>
          <Text variant="titleLarge">{user?.name ?? 'Your account'}</Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
            {user?.email}
          </Text>
        </View>
      </View>
      <Divider />
      <List.Section>
        <List.Subheader>Workspace</List.Subheader>
        {item(t('settings.team'), 'account-group-outline', '/team')}
        {item(t('settings.templates'), 'view-grid-outline', '/templates')}
        {item(t('settings.databases'), 'database-outline', '/settings/databases')}
        {item(t('settings.usage'), 'chart-bar', '/settings/usage')}
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>{t('settings.title')}</List.Subheader>
        {item(t('settings.account'), 'account-outline', '/settings/account')}
        {item(t('settings.security'), 'shield-lock-outline', '/settings/security')}
        {item(t('settings.apiKeys'), 'key-outline', '/settings/api-keys')}
        {item(t('settings.connections'), 'link-variant', '/settings/connections')}
        {item(t('settings.notifications'), 'bell-outline', '/settings/notifications')}
        {item(t('settings.appearance'), 'palette-outline', '/settings/appearance')}
        {item(t('settings.about'), 'information-outline', '/settings/about')}
      </List.Section>
      <Divider />
      <List.Section>
        <List.Item title={t('settings.support')} left={(p) => <List.Icon {...p} icon="lifebuoy" />} onPress={() => Linking.openURL(supportMailto(user?.id))} />
        <List.Item title="Privacy Policy" left={(p) => <List.Icon {...p} icon="shield-account-outline" />} onPress={() => WebBrowser.openBrowserAsync(legalUrls.privacy)} />
        <List.Item title={t('settings.signOut')} left={(p) => <List.Icon {...p} icon="logout" />} onPress={() => setConfirm(true)} />
        <List.Item
          title={t('settings.deleteAccount')}
          titleStyle={{ color: theme.colors.error }}
          left={(p) => <List.Icon {...p} icon="account-remove-outline" color={theme.colors.error} />}
          onPress={() => router.push('/settings/delete-account')}
        />
      </List.Section>
      <ConfirmDialog
        visible={confirm}
        title={t('settings.signOut')}
        body="You can sign back in at any time."
        confirmLabel={t('settings.signOut')}
        onConfirm={() => signOut('user')}
        onDismiss={() => setConfirm(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  flex: { flex: 1 },
});
