import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { authApi } from '@/api/endpoints/auth';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { track } from '@/lib/analytics';
import { isValidToken } from '@/lib/deepLinks';
import { useSession } from '@/stores/session';

/**
 * Landing route for ideaplatform://oauth?code=… when the OS delivers the
 * redirect to the app instead of the open auth session (e.g. after a process
 * kill). Only the one-time exchange code is accepted (§6.2, §10).
 */
export default function OAuthReturn() {
  const params = useLocalSearchParams<{ code?: string; type?: string }>();
  const codeRef = useRef(isValidToken(params.code) ? params.code : null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const code = codeRef.current;
    codeRef.current = null;
    router.setParams({ code: undefined });
    const status = useSession.getState().status;
    if (!code || params.type === 'connection' || status === 'signedIn') {
      router.replace('/');
      return;
    }
    authApi
      .oauthExchange(code)
      .then(async (session) => {
        await useSession.getState().signIn(session);
        track('login', { method: 'github' });
        router.replace('/');
      })
      .catch(setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <Screen>{error ? <ErrorView error={error} onRetry={() => router.replace('/welcome')} /> : <LoadingView label="Signing you in…" />}</Screen>;
}
