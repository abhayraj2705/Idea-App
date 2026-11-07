import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Dialog, HelperText, IconButton, List, Portal, Snackbar, Text, TextInput } from 'react-native-paper';

import { connectionsApi, errorMessage, type ConnectionCapability } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { AuthCancelled, connectProvider } from '@/features/auth/socialAuth';
import { qk, useConnectionCapabilities, useConnections } from '@/features/queries';
import { timeAgo } from '@/lib/format';
import { useAppTheme } from '@/theme/theme';

export default function Connections() {
  const theme = useAppTheme();
  const qc = useQueryClient();
  const caps = useConnectionCapabilities();
  const conns = useConnections();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patFor, setPatFor] = useState<ConnectionCapability | null>(null);
  const [pat, setPat] = useState('');
  const [toRemove, setToRemove] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: qk.connections }), qc.invalidateQueries({ queryKey: qk.deployProviders })]);

  const oauth = async (provider: string) => {
    setBusy(provider);
    setError(null);
    try {
      await connectProvider(provider);
      await refresh();
      setSnack('Connected');
    } catch (e) {
      if (!(e instanceof AuthCancelled)) setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (caps.isLoading || conns.isLoading) return <LoadingView />;
  if (caps.isError) return <ErrorView error={caps.error} onRetry={() => caps.refetch()} />;

  return (
    <Screen refreshing={conns.isRefetching} onRefresh={() => conns.refetch()}>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        Connect GitHub, Vercel and Railway to push code and deploy from your phone.
      </Text>
      {(caps.data ?? []).map((c) => {
        const linked = (conns.data ?? []).filter((x) => x.provider === c.provider);
        return (
          <Card key={c.provider} mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Title title={c.name} subtitle={linked.length ? `${linked.length} connected` : 'Not connected'} />
            {linked.map((l) => (
              <List.Item
                key={l.id}
                title={l.account ?? c.name}
                description={timeAgo(l.createdAt)}
                left={(p) => <List.Icon {...p} icon="link-variant" />}
                right={() => <IconButton icon="link-variant-off" onPress={() => setToRemove(l.id)} accessibilityLabel={`Disconnect ${l.account ?? c.name}`} />}
              />
            ))}
            <Card.Actions>
              {c.pat ? (
                <Button onPress={() => setPatFor(c)} disabled={!!busy}>
                  Use a token
                </Button>
              ) : null}
              {c.oauth ? (
                <Button mode="contained" icon="login" loading={busy === c.provider} disabled={!!busy} onPress={() => oauth(c.provider)}>
                  Connect
                </Button>
              ) : null}
            </Card.Actions>
          </Card>
        );
      })}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}

      <Portal>
        <Dialog visible={!!patFor} onDismiss={() => setPatFor(null)}>
          <Dialog.Title>{patFor?.name} token</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Personal access token" secureTextEntry autoCapitalize="none" value={pat} onChangeText={setPat} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPatFor(null)}>Cancel</Button>
            <Button
              disabled={!pat.trim()}
              loading={busy === 'pat'}
              onPress={async () => {
                if (!patFor) return;
                setBusy('pat');
                try {
                  await connectionsApi.savePat(patFor.provider, pat.trim());
                  setPat('');
                  setPatFor(null);
                  await refresh();
                  setSnack('Connected');
                } catch (e) {
                  setSnack(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ConfirmDialog
        visible={!!toRemove}
        title="Disconnect?"
        body="We’ll revoke access where the provider allows it."
        confirmLabel="Disconnect"
        destructive
        onConfirm={async () => {
          try {
            await connectionsApi.remove(toRemove!);
            await refresh();
          } catch (e) {
            setSnack(errorMessage(e));
          } finally {
            setToRemove(null);
          }
        }}
        onDismiss={() => setToRemove(null)}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}
