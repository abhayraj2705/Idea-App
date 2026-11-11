import { Stack } from 'expo-router';

import { headerOptions } from '@/theme/navigation';
import { useAppTheme } from '@/theme/theme';

export default function SettingsLayout() {
  const theme = useAppTheme();
  return (
    <Stack screenOptions={headerOptions(theme)}>
      <Stack.Screen name="account" options={{ title: 'Account' }} />
      <Stack.Screen name="security" options={{ title: 'Security' }} />
      <Stack.Screen name="api-keys" options={{ title: 'API keys' }} />
      <Stack.Screen name="connections" options={{ title: 'Connections' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
      <Stack.Screen name="databases" options={{ title: 'Databases' }} />
      <Stack.Screen name="usage" options={{ title: 'Usage' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
    </Stack>
  );
}
