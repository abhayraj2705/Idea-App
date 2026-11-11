import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, IconButton, List, Menu, Snackbar, Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { TextInput } from '@/components/TextInput';

import { errorMessage, teamsApi, type TeamMember, type TeamRole } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Screen } from '@/components/Screen';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { qk, useTeam } from '@/features/queries';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

type Pending = { title: string; body: string; label: string; destructive?: boolean; run: () => Promise<unknown> } | null;

export default function TeamScreen() {
  const theme = useAppTheme();
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const team = useTeam();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.team });

  if (team.isLoading) return <LoadingView />;
  if (team.isError) return <ErrorView error={team.error} onRetry={() => team.refetch()} />;

  if (!team.data) {
    return (
      <Screen keyboard>
        <EmptyView icon="account-group-outline" title="Build with your team" body="Share projects, review changes together and deploy as a team." />
        <TextInput mode="outlined" label="Team name" value={name} onChangeText={setName} maxLength={60} />
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
        <Button
          mode="contained"
          loading={creating}
          disabled={creating || name.trim().length < 2}
          onPress={async () => {
            setCreating(true);
            setError(null);
            try {
              qc.setQueryData(qk.team, await teamsApi.create(name.trim()));
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setCreating(false);
            }
          }}
        >
          Create team
        </Button>
      </Screen>
    );
  }

  const t = team.data;
  const canManage = t.myRole === 'owner' || t.myRole === 'admin';
  const isOwner = t.myRole === 'owner';

  const confirm = (p: Pending) => {
    setMenuFor(null);
    setPending(p);
  };
  const runPending = async () => {
    if (!pending) return;
    try {
      await pending.run();
      await refresh();
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setPending(null);
    }
  };
  const setRole = (m: TeamMember, role: TeamRole) =>
    confirm({ title: `Make ${m.name ?? m.email} ${role}?`, body: '', label: 'Change role', run: () => teamsApi.setRole(m.userId, role) });

  return (
    <>
      <Screen refreshing={team.isRefetching} onRefresh={() => team.refetch()}>
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.flex}>
            {t.name}
          </Text>
          {canManage ? (
            <Button mode="contained" icon="account-plus-outline" onPress={() => router.push('/team/invite')}>
              Invite
            </Button>
          ) : null}
        </View>
        <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
          {t.members.map((m) => {
            const self = m.userId === me?.id;
            return (
              <List.Item
                key={m.userId}
                title={`${m.name ?? m.email}${self ? ' (you)' : ''}`}
                description={m.email}
                left={() => (
                  <View style={styles.avatar}>
                    <Avatar name={m.name ?? m.email} size={36} />
                  </View>
                )}
                right={() => (
                  <View style={styles.row}>
                    <StatusChip status="draft" label={m.role} compact />
                    {canManage && !self && m.role !== 'owner' ? (
                      <Menu visible={menuFor === m.userId} onDismiss={() => setMenuFor(null)} anchor={<IconButton icon="dots-vertical" onPress={() => setMenuFor(m.userId)} accessibilityLabel={`Manage ${m.email}`} />}>
                        <Menu.Item title="Make admin" leadingIcon="shield-account-outline" onPress={() => setRole(m, 'admin')} disabled={m.role === 'admin'} />
                        <Menu.Item title="Make member" leadingIcon="account-outline" onPress={() => setRole(m, 'member')} disabled={m.role === 'member'} />
                        {isOwner ? (
                          <Menu.Item
                            title="Transfer ownership"
                            leadingIcon="crown-outline"
                            onPress={() => confirm({ title: 'Transfer ownership?', body: `${m.email} will become the owner. You’ll become an admin.`, label: 'Transfer', run: () => teamsApi.transferOwnership(m.userId) })}
                          />
                        ) : null}
                        <Menu.Item
                          title="Remove"
                          leadingIcon="account-remove-outline"
                          onPress={() => confirm({ title: `Remove ${m.email}?`, body: 'They lose access to team projects.', label: 'Remove', destructive: true, run: () => teamsApi.removeMember(m.userId) })}
                        />
                      </Menu>
                    ) : null}
                  </View>
                )}
              />
            );
          })}
        </Card>

        {t.invites?.length ? (
          <>
            <Text variant="titleMedium">Pending invites</Text>
            <Card mode="outlined" style={{ borderColor: theme.colors.border }}>
              {t.invites.map((inv) => (
                <List.Item
                  key={inv.token}
                  title={inv.email}
                  description={inv.role}
                  left={(p) => <List.Icon {...p} icon="email-outline" />}
                  right={() =>
                    canManage ? (
                      <IconButton icon="close" accessibilityLabel={`Revoke invite for ${inv.email}`} onPress={() => confirm({ title: 'Revoke invite?', body: inv.email, label: 'Revoke', destructive: true, run: () => teamsApi.revokeInvite(inv.token) })} />
                    ) : null
                  }
                />
              ))}
            </Card>
          </>
        ) : null}

        {isOwner ? (
          <Button
            textColor={theme.colors.error}
            icon="delete-outline"
            onPress={() => confirm({ title: 'Delete team?', body: 'Projects stay with their owners. This cannot be undone.', label: 'Delete team', destructive: true, run: () => teamsApi.dissolve().then(() => qc.setQueryData(qk.team, null)) })}
          >
            Delete team
          </Button>
        ) : (
          <Button
            textColor={theme.colors.error}
            icon="logout"
            onPress={() => confirm({ title: 'Leave team?', body: 'You’ll lose access to shared projects.', label: 'Leave', destructive: true, run: () => teamsApi.leave().then(() => qc.setQueryData(qk.team, null)) })}
          >
            Leave team
          </Button>
        )}
      </Screen>
      <ConfirmDialog visible={!!pending} title={pending?.title ?? ''} body={pending?.body || undefined} confirmLabel={pending?.label ?? 'OK'} destructive={pending?.destructive} onConfirm={runPending} onDismiss={() => setPending(null)} />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { marginLeft: 8, alignSelf: 'center' },
});
