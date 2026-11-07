import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useTranslation } from '@/i18n';
import { isValidToken } from '@/lib/deepLinks';
import { useSession } from '@/stores/session';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ token?: string }>();
  const tokenRef = useRef(isValidToken(params.token) ? params.token : null);
  const status = useSession((s) => s.status);
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (params.token) router.setParams({ token: undefined });
    const token = tokenRef.current;
    tokenRef.current = null; // used once
    if (!token) {
      setError(new Error('This verification link is invalid or has expired.'));
      setState('error');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(async () => {
        setState('done');
        if (useSession.getState().status === 'signedIn') {
          const me = await authApi.me().catch(() => null);
          if (me) useSession.getState().setUser(me);
          void qc.invalidateQueries({ queryKey: ['me'] });
        }
      })
      .catch((e) => {
        setError(new Error(errorMessage(e)));
        setState('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goOn = () => router.replace(status === 'signedIn' ? '/home' : '/sign-in');

  return (
    <Screen>
      {state === 'working' ? <LoadingView label={t('auth.verifyingEmail')} /> : null}
      {state === 'done' ? (
        <EmptyView
          icon="email-check-outline"
          title={t('auth.emailVerified')}
          action={
            <Button mode="contained" onPress={goOn}>
              {t('common.continue')}
            </Button>
          }
        />
      ) : null}
      {state === 'error' ? <ErrorView error={error} title="Couldn’t verify email" /> : null}
    </Screen>
  );
}
