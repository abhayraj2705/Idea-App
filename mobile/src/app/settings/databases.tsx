import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import { dbApi, errorMessage } from '@/api';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { useDbConnections } from '@/features/queries';
import { config } from '@/lib/config';
import { useAppTheme } from '@/theme/theme';

/** v1 is list + test only; creating/provisioning opens the web (§1.1). */
export default function Databases() {
  const theme = useAppTheme();
  const dbs = useDbConnections();
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [snack, setSnack] = useState<string | null>(null);

  if (dbs.isLoading) return <LoadingView />;
  if (dbs.isError) return <ErrorView error={dbs.error} onRetry={() => dbs.refetch()} />;

  return (
    <Screen refreshing={dbs.isRefetching} onRefresh={() => dbs.refetch()}>
      {(dbs.data ?? []).length === 0 ? <EmptyView icon="database-outline" title="No database connections" body="Add one on the web to connect it to your projects." /> : null}
      {(dbs.data ?? []).map((d) => {
        const r = results[d.id];
        return (
          <Card key={d.id} mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Title title={d.name} subtitle={d.engine} />
            {r ? (
              <Card.Content>
                <StatusChip status={r.ok ? 'complete' : 'failed'} label={r.text} />
              </Card.Content>
            ) : null}
            <Card.Actions>
              <Button
                icon="lan-connect"
                loading={testing === d.id}
                disabled={!!testing}
                onPress={async () => {
                  setTesting(d.id);
                  try {
                    const res = await dbApi.test(d.id);
                    setResults((x) => ({ ...x, [d.id]: { ok: res.ok, text: res.ok ? `Connected${res.latencyMs != null ? ` · ${res.latencyMs} ms` : ''}` : res.message ?? 'Failed' } }));
                  } catch (e) {
                    setSnack(errorMessage(e));
                  } finally {
                    setTesting(null);
                  }
                }}
              >
                Test connection
              </Button>
            </Card.Actions>
          </Card>
        );
      })}
      <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
        To add or provision a database, use the web app.
      </Text>
      <Button icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(`${config.webUrl}/settings/databases`)}>
        Manage on web
      </Button>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}
