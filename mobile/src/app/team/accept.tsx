import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button } from 'react-native-paper';

import { teamsApi } from '@/api/endpoints/platform';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { isValidToken } from '@/lib/deepLinks';
import { useSession } from '@/stores/session';

export default function AcceptInvite() {
  const params = useLocalSearchParams<{ token?: string }>();
  const qc = useQueryClient();
  const status = useSession((s) => s.status);
  // Captured once; stripped from navigation state below (§10).
  const [token] = useState(() => (isValidToken(params.token) ? params.token : null));
  const accept = useMutation({
    mutationFn: teamsApi.acceptInvite,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team'] }),
  });

  useEffect(() => {
    if (params.token) router.setParams({ token: undefined });
  }, [params.token]);

  useEffect(() => {
    if (!token || accept.status !== 'idle') return;
    if (status !== 'signedIn') {
      // Keep it in memory, sign in, and come back (see RootNavigator).
      useSession.getState().setPendingInvite(token);
      router.replace('/welcome');
      return;
    }
    useSession.getState().setPendingInvite(null);
    accept.mutate(token);
  }, [status, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <Screen>
        <ErrorView error={new Error('This invite link is invalid or has expired.')} title="Couldn’t accept invite" />
      </Screen>
    );
  }

  return (
    <Screen>
      {accept.isPending || accept.isIdle ? <LoadingView label="Joining team…" /> : null}
      {accept.isSuccess ? (
        <EmptyView
          icon="account-group-outline"
          title={`You joined ${accept.data.name}`}
          action={
            <Button mode="contained" onPress={() => router.replace('/team')}>
              Open team
            </Button>
          }
        />
      ) : null}
      {accept.isError ? <ErrorView error={accept.error} title="Couldn’t accept invite" /> : null}
    </Screen>
  );
}
