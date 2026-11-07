import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNetworkState } from 'expo-network';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme';

export function useIsOffline() {
  const net = useNetworkState();
  return net.isConnected === false || net.isInternetReachable === false;
}

export function OfflineBanner({ message }: { message?: string }) {
  const offline = useIsOffline();
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!offline) return null;
  return (
    <View
      style={[styles.banner, { backgroundColor: theme.colors.inverseSurface }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <MaterialCommunityIcons name="wifi-off" size={16} color={theme.colors.inverseOnSurface} />
      <Text variant="labelMedium" style={{ color: theme.colors.inverseOnSurface, flex: 1 }}>
        {message ?? t('common.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
});
