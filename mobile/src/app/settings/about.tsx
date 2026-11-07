import * as WebBrowser from 'expo-web-browser';
import { Image, StyleSheet, View } from 'react-native';
import { Divider, List, Text } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import { config, legalUrls } from '@/lib/config';
import { useAppTheme } from '@/theme/theme';

export default function About() {
  const theme = useAppTheme();
  const open = (url: string) => WebBrowser.openBrowserAsync(url);
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text variant="titleLarge">IDEA</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
          Version {config.appVersion} ({config.buildNumber}) · {config.appEnv}
        </Text>
      </View>
      <Divider />
      <List.Item title="Privacy Policy" left={(p) => <List.Icon {...p} icon="shield-account-outline" />} right={(p) => <List.Icon {...p} icon="open-in-new" />} onPress={() => open(legalUrls.privacy)} />
      <List.Item title="Terms of Service" left={(p) => <List.Icon {...p} icon="file-document-outline" />} right={(p) => <List.Icon {...p} icon="open-in-new" />} onPress={() => open(legalUrls.terms)} />
      <List.Item title="Open-source licences" left={(p) => <List.Icon {...p} icon="scale-balance" />} right={(p) => <List.Icon {...p} icon="open-in-new" />} onPress={() => open(`${config.webUrl}/licenses/mobile`)} />
      <List.Item title="Request account deletion on the web" left={(p) => <List.Icon {...p} icon="account-remove-outline" />} right={(p) => <List.Icon {...p} icon="open-in-new" />} onPress={() => open(legalUrls.deleteAccount)} />
      <List.Item title="Help & support" left={(p) => <List.Icon {...p} icon="lifebuoy" />} right={(p) => <List.Icon {...p} icon="open-in-new" />} onPress={() => open(legalUrls.support)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: 6, padding: 24 },
  logo: { width: 72, height: 72, borderRadius: 18 },
});
