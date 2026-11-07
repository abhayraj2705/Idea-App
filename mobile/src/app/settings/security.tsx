import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Divider, HelperText, List, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { QRCode } from '@/components/QRCode';

import { authApi, errorMessage } from '@/api';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { changePasswordSchema as pwSchema } from '@/features/auth/schemas';
import { usePrefs } from '@/stores/prefs';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

/** Blocks screenshots / recording and blurs the app-switcher snapshot while a TOTP secret is visible (§10). */
function SecretGuard() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void ScreenCapture.preventScreenCaptureAsync('totp').catch(() => {});
    return () => {
      void ScreenCapture.allowScreenCaptureAsync('totp').catch(() => {});
    };
  }, []);
  return null;
}

export default function Security() {
  const theme = useAppTheme();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const appLock = usePrefs((s) => s.appLock);
  const setPrefs = usePrefs((s) => s.set);
  const [snack, setSnack] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [tfaError, setTfaError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => setBioAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())))();
  }, []);

  const pw = useForm({ resolver: zodResolver(pwSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const changePassword = pw.handleSubmit(async ({ currentPassword, newPassword }) => {
    setPwError(null);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      pw.reset();
      setSnack('Password changed');
    } catch (e) {
      setPwError(errorMessage(e));
    }
  });

  const twoFactorOn = !!user?.twoFactorEnabled;

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    setTfaError(null);
    try {
      await fn();
    } catch (e) {
      setTfaError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen keyboard>
      <Text variant="titleMedium">Two-factor authentication</Text>
      {!twoFactorOn && !setup ? (
        <Button mode="contained-tonal" icon="shield-key-outline" loading={busy === 'setup'} onPress={() => run('setup', async () => setSetup(await authApi.setup2fa()))}>
          Turn on two-factor
        </Button>
      ) : null}
      {setup ? (
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          <SecretGuard />
          <Card.Content style={styles.gap}>
            <Text variant="bodyMedium">
              Add this key to your authenticator app. If the authenticator is on this phone, copy the key — you can’t scan your own screen.
            </Text>
            <View style={styles.secretRow}>
              <Text variant="titleMedium" selectable style={styles.secret}>
                {setup.secret}
              </Text>
              <Button
                compact
                icon="content-copy"
                onPress={async () => {
                  await Clipboard.setStringAsync(setup.secret);
                  setSnack('Key copied');
                }}
              >
                Copy
              </Button>
            </View>
            <View style={[styles.qr, { backgroundColor: theme.colors.surface }]}>
              <QRCode value={setup.otpauthUrl} size={180} color={theme.colors.onSurface} backgroundColor={theme.colors.surface} />
            </View>
            <TextInput mode="outlined" label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
            <Button
              mode="contained"
              disabled={!/^\d{6}$/.test(code)}
              loading={busy === 'enable'}
              onPress={() =>
                run('enable', async () => {
                  const res = await authApi.enable2fa(code);
                  if (user) setUser({ ...user, twoFactorEnabled: true });
                  setSetup(null);
                  setCode('');
                  setRecovery(res.recoveryCodes ?? null);
                  setSnack('Two-factor is on');
                })
              }
            >
              Verify and turn on
            </Button>
          </Card.Content>
        </Card>
      ) : null}
      {recovery?.length ? (
        <Card mode="contained">
          <SecretGuard />
          <Card.Title title="Recovery codes" subtitle="Store these somewhere safe. Each works once." />
          <Card.Content>
            <Text selectable style={styles.secret}>
              {recovery.join('\n')}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => setRecovery(null)}>I’ve saved them</Button>
          </Card.Actions>
        </Card>
      ) : null}
      {twoFactorOn ? (
        <View style={styles.gap}>
          <List.Item title="Two-factor is on" left={(p) => <List.Icon {...p} icon="shield-check" color={theme.colors.success} />} />
          <TextInput mode="outlined" label="Code to turn off" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button
            textColor={theme.colors.error}
            disabled={!/^\d{6}$/.test(code)}
            loading={busy === 'disable'}
            onPress={() =>
              run('disable', async () => {
                await authApi.disable2fa({ code });
                if (user) setUser({ ...user, twoFactorEnabled: false });
                setCode('');
                setSnack('Two-factor is off');
              })
            }
          >
            Turn off two-factor
          </Button>
        </View>
      ) : null}
      {tfaError ? <HelperText type="error" visible>{tfaError}</HelperText> : null}

      <Divider />
      {bioAvailable ? (
        <List.Item
          title="App lock"
          description="Require Face ID, fingerprint or passcode to open IDEA"
          left={(p) => <List.Icon {...p} icon="fingerprint" />}
          right={() => (
            <Switch
              value={appLock}
              onValueChange={async (v) => {
                if (v) {
                  const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on App Lock' });
                  if (!res.success) return;
                }
                setPrefs({ appLock: v });
              }}
            />
          )}
        />
      ) : null}

      <Divider />
      <Text variant="titleMedium">Change password</Text>
      <FormField control={pw.control} name="currentPassword" label="Current password" secure autoComplete="current-password" />
      <FormField control={pw.control} name="newPassword" label="New password" secure autoComplete="new-password" />
      <FormField control={pw.control} name="confirm" label="Confirm new password" secure autoComplete="new-password" />
      {pwError ? <HelperText type="error" visible>{pwError}</HelperText> : null}
      <Button mode="contained" onPress={() => void changePassword()} loading={pw.formState.isSubmitting} disabled={pw.formState.isSubmitting}>
        Change password
      </Button>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: 12 },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secret: { flex: 1, fontFamily: 'monospace', letterSpacing: 1 },
  qr: { alignSelf: 'center', padding: 12, borderRadius: 12 },
});
