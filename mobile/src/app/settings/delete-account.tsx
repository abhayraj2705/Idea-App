import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';

import { authApi, errorMessage } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { legalUrls } from '@/lib/config';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';
import { font } from '@/theme/fonts';

const CONSEQUENCES = [
  'All your projects, conversations and restore points',
  'Connected accounts (GitHub, Vercel, Railway) and saved API keys',
  'Running generations are cancelled',
  'Push notifications to your devices',
];

/**
 * In-app account deletion (Apple 5.1.1(v), Google Play account deletion policy, §6.4).
 * Requires password (or a 2FA code) to re-confirm. A web URL is also offered.
 */
export default function DeleteAccount() {
  const theme = useAppTheme();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = typed.trim().toUpperCase() === 'DELETE' && (password.length > 0 || /^\d{6}$/.test(code));

  const remove = async () => {
    setError(null);
    try {
      await authApi.deleteAccount({ password: password || undefined, code: code || undefined });
      setConfirm(false);
      await signOut('deleted');
    } catch (e) {
      setConfirm(false);
      setError(errorMessage(e));
    }
  };

  return (
    <Screen keyboard>
      <View style={[styles.icon, { backgroundColor: theme.colors.errorContainer }]}>
        <MaterialCommunityIcons name="account-remove-outline" size={36} color={theme.colors.error} />
      </View>
      <Text variant="headlineSmall">Delete your account</Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        This permanently deletes {user?.email ? <Text style={styles.bold}>{user.email}</Text> : 'your account'} and everything in it. It can’t be undone.
      </Text>
      <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
        <Card.Content style={styles.gap}>
          {CONSEQUENCES.map((c) => (
            <View key={c} style={styles.row}>
              <MaterialCommunityIcons name="close-circle-outline" size={18} color={theme.colors.error} />
              <Text variant="bodyMedium" style={styles.flex}>
                {c}
              </Text>
            </View>
          ))}
          <View style={styles.row}>
            <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.textMuted} />
            <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.textMuted }]}>
              If you own a team with other members, transfer ownership first.
            </Text>
          </View>
        </Card.Content>
      </Card>

      <TextInput mode="outlined" label="Password" secureTextEntry value={password} onChangeText={setPassword} autoComplete="current-password" />
      {user?.twoFactorEnabled ? (
        <TextInput mode="outlined" label="Or a 2FA code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      ) : (
        <HelperText type="info" visible>
          Signed in with Apple, Google or GitHub and have no password? Use “Forgot password” to set one, or delete on the web.
        </HelperText>
      )}
      <TextInput mode="outlined" label='Type "DELETE" to confirm' value={typed} onChangeText={setTyped} autoCapitalize="characters" />
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      <Button mode="contained" buttonColor={theme.colors.error} textColor={theme.colors.onError} disabled={!ready} onPress={() => setConfirm(true)}>
        Delete my account
      </Button>
      <Button icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(legalUrls.deleteAccount)}>
        Delete on the web instead
      </Button>
      <ConfirmDialog visible={confirm} title="Delete account permanently?" body="All your data will be removed. This cannot be undone." confirmLabel="Delete forever" destructive onConfirm={remove} onDismiss={() => setConfirm(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  gap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  bold: { fontFamily: font.bold },
});
