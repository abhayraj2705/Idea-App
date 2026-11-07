import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import type { AuthSession } from '@/api/types';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { config } from '@/lib/config';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

import { AuthCancelled, appleAvailable, googleConfigured, signInWithApple, signInWithGitHub } from './socialAuth';

function useFinish() {
  const signIn = useSession((s) => s.signIn);
  return async (method: string, fn: () => Promise<AuthSession>) => {
    const session = await fn();
    await signIn(session);
    track('login', { method });
  };
}

/** Rendered only when a client id exists for this platform, because the hook asserts on it. */
function GoogleButton({ onError, busy, setBusy }: { onError: (m: string) => void; busy: boolean; setBusy: (b: boolean) => void }) {
  const { t } = useTranslation();
  const finish = useFinish();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: config.googleClientIds.ios || undefined,
    androidClientId: config.googleClientIds.android || undefined,
    webClientId: config.googleClientIds.web || undefined,
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response) setBusy(false);
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) {
      onError('Google did not return a token.');
      setBusy(false);
      return;
    }
    finish('google', () => authApi.google(idToken))
      .catch((e) => onError(errorMessage(e)))
      .finally(() => setBusy(false));
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Button
      mode="outlined"
      icon="google"
      disabled={!request || busy}
      onPress={() => {
        setBusy(true);
        void promptAsync();
      }}
      contentStyle={styles.btn}
    >
      {t('auth.continueGoogle')}
    </Button>
  );
}

export function SocialAuthButtons() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const finish = useFinish();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void appleAvailable().then(setApple);
  }, []);

  const run = async (method: string, fn: () => Promise<AuthSession>) => {
    setError(null);
    setBusy(true);
    try {
      await finish(method, fn);
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {/* App Store 4.8: Sign in with Apple is offered wherever other social sign-in is. */}
      {apple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            theme.dark
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={24}
          style={styles.apple}
          onPress={() => run('apple', signInWithApple)}
        />
      ) : null}
      {googleConfigured() ? <GoogleButton onError={setError} busy={busy} setBusy={setBusy} /> : null}
      <Button mode="outlined" icon="github" disabled={busy} onPress={() => run('github', signInWithGitHub)} contentStyle={styles.btn}>
        {t('auth.continueGithub')}
      </Button>
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  btn: { minHeight: 48 },
  apple: { height: 48, width: '100%' },
});
