import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, IconButton, Snackbar, Text, TextInput } from 'react-native-paper';

import { authApi, errorMessage } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', hint: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', hint: 'sk-…' },
  { id: 'google', name: 'Google AI', hint: 'AIza…' },
];

/**
 * Bring-your-own key. Keys are sent once to /api-keys and sealed server-side;
 * they are never stored on the device (§10).
 */
export default function ApiKeys() {
  const theme = useAppTheme();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const saved = (id: string) => user?.apiKeys?.find((k) => k.provider === id);

  const save = async (id: string) => {
    const key = drafts[id]?.trim();
    if (!key) return;
    setBusy(id);
    setError(null);
    try {
      await authApi.saveApiKey(id, key);
      setDrafts((d) => ({ ...d, [id]: '' })); // drop from memory immediately
      if (user) setUser({ ...user, apiKeys: [...(user.apiKeys ?? []).filter((k) => k.provider !== id), { provider: id, last4: key.slice(-4) }] });
      setSnack('Key saved securely');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await authApi.deleteApiKey(toDelete);
      if (user) setUser({ ...user, apiKeys: (user.apiKeys ?? []).filter((k) => k.provider !== toDelete) });
      setSnack('Key removed');
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setToDelete(null);
    }
  };

  return (
    <Screen keyboard>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        Use your own provider key for generations. Keys are encrypted on our servers and never stored on this phone.
      </Text>
      {PROVIDERS.map((p) => {
        const s = saved(p.id);
        return (
          <Card key={p.id} mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Title
              title={p.name}
              subtitle={s ? `Saved · ends in ${s.last4 ?? '••••'}` : 'Not set'}
              right={() => (s ? <IconButton icon="trash-can-outline" onPress={() => setToDelete(p.id)} accessibilityLabel={`Remove ${p.name} key`} /> : null)}
            />
            <Card.Content style={styles.row}>
              <TextInput
                mode="outlined"
                dense
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={s ? 'Replace key' : p.hint}
                value={drafts[p.id] ?? ''}
                onChangeText={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
                style={styles.flex}
                accessibilityLabel={`${p.name} API key`}
              />
              <Button mode="contained" onPress={() => save(p.id)} loading={busy === p.id} disabled={!drafts[p.id]?.trim() || !!busy}>
                Save
              </Button>
            </Card.Content>
          </Card>
        );
      })}
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      <View />
      <ConfirmDialog visible={!!toDelete} title="Remove this key?" body="Generations will use the platform’s models again." confirmLabel="Remove" destructive onConfirm={remove} onDismiss={() => setToDelete(null)} />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 } });
