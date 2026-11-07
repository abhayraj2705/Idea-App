import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Dialog, IconButton, Portal, Snackbar, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { aiApi, errorMessage, projectsApi, type ChatMessage, type ChatMode } from '@/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { MarkdownView } from '@/components/MarkdownView';
import { useIsOffline } from '@/components/OfflineBanner';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { isTerminal } from '@/features/generation/eventReducer';
import { useJobStream } from '@/features/generation/useJobStream';
import { qk, useProject } from '@/features/queries';
import { track } from '@/lib/analytics';
import { timeAgo, uuid } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useDraft } from '@/stores/draft';
import { useFeatures } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

const MODE_HELP: Record<ChatMode, string> = {
  ask: 'Ask questions — no code changes',
  edit: 'Propose a targeted change for review',
  agent: 'Multi-step changes across files',
  chat: 'Talk about the project',
  refine: 'Change the project directly',
};

const Bubble = memo(function Bubble({ m, projectId, onRestore }: { m: ChatMessage; projectId: string; onRestore: (m: ChatMessage) => void }) {
  const theme = useAppTheme();
  const mine = m.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
      <View
        style={[styles.bubble, { backgroundColor: mine ? theme.colors.primary : theme.colors.surfaceVariant }]}
        accessibilityLabel={`${mine ? 'You' : 'Assistant'}: ${m.content}`}
      >
        {mine ? (
          <Text style={{ color: theme.colors.onPrimary }} selectable>
            {m.content}
          </Text>
        ) : (
          <MarkdownView>{m.content}</MarkdownView>
        )}
        {m.proposalId ? (
          <Button compact mode="contained-tonal" icon="file-compare" onPress={() => router.push(`/project/${projectId}/proposal/${m.proposalId}`)} style={styles.inlineBtn}>
            Review changes
          </Button>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text variant="labelSmall" style={{ color: theme.colors.textSubtle }}>
          {timeAgo(m.createdAt)}
        </Text>
        {m.checkpointId ? (
          <Button compact icon="restore" onPress={() => onRestore(m)} labelStyle={styles.metaBtn}>
            Restore to here
          </Button>
        ) : null}
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const flags = useFeatures();
  const offline = useIsOffline();
  const project = useProject(id);
  const modes: ChatMode[] = flags.editChat ? ['ask', 'edit', 'agent'] : ['chat', 'refine'];
  const [mode, setMode] = useState<ChatMode>(modes[0]!);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [turnJob, setTurnJob] = useState<string | undefined>();
  const [restoreTarget, setRestoreTarget] = useState<ChatMessage | null>(null);
  const [scopeDismissed, setScopeDismissed] = useState<string | undefined>();
  const [snack, setSnack] = useState<string | null>(null);

  const conversation = useQuery({
    queryKey: qk.conversation(id),
    queryFn: async () => {
      const list = await projectsApi.conversations(id);
      return list[0] ?? (await projectsApi.createConversation(id));
    },
    enabled: flags.conversationThread,
  });
  const convId = conversation.data?.id;

  const messages = useInfiniteQuery({
    queryKey: qk.messages(convId ?? ''),
    queryFn: ({ pageParam }) => projectsApi.messages(id, convId!, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasMore && last.messages.length ? Math.min(...last.messages.map((m) => m.seq)) : undefined),
    enabled: !!convId,
  });

  const data = useMemo(() => {
    const all = (messages.data?.pages ?? []).flatMap((p) => p.messages);
    const seen = new Set<string>();
    return all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).sort((a, b) => a.seq - b.seq);
  }, [messages.data]);

  // Live turn stream (Edit chat): turn / delta / agent_step / proposal / scope_upgrade_required.
  const { state: turn } = useJobStream(turnJob, { enabled: !!turnJob });
  const scopeSheet = !!turnJob && turn.scopeUpgradeRequired && scopeDismissed !== turnJob;
  const setScopeSheet = (open: boolean) => {
    if (!open) setScopeDismissed(turnJob);
  };
  useEffect(() => {
    if (!turnJob || !isTerminal(turn)) return;
    if (turn.proposalId) router.push(`/project/${id}/proposal/${turn.proposalId}`);
    void qc.invalidateQueries({ queryKey: qk.messages(convId ?? '') });
  }, [turn.endStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    const optimistic: ChatMessage = { id: `local-${uuid()}`, seq: (data.at(-1)?.seq ?? 0) + 0.5, role: 'user', content, mode, createdAt: new Date().toISOString() };
    qc.setQueryData(qk.messages(convId ?? ''), (old: typeof messages.data) =>
      old ? { ...old, pages: old.pages.map((p, i) => (i === 0 ? { ...p, messages: [...p.messages, optimistic] } : p)) } : old,
    );
    try {
      track('chat_turn', { mode });
      if (flags.editChat) {
        const res = await aiApi.chatV2({ projectId: id, conversationId: convId, mode, message: content });
        if (res.jobId) setTurnJob(res.jobId);
        else if (res.proposalId) router.push(`/project/${id}/proposal/${res.proposalId}`);
      } else {
        await aiApi.chatLegacy({ projectId: id, message: content, mode: mode === 'refine' ? 'refine' : 'chat' });
      }
      void qc.invalidateQueries({ queryKey: qk.messages(convId ?? '') });
    } catch (e) {
      setText(content);
      setSnack(errorMessage(e));
      void qc.invalidateQueries({ queryKey: qk.messages(convId ?? '') });
    } finally {
      setSending(false);
    }
  };

  const restore = async () => {
    if (!restoreTarget?.checkpointId) return;
    try {
      await projectsApi.restoreCheckpoint(id, restoreTarget.checkpointId);
      track('checkpoint_restored');
      haptics.success();
      setSnack('Restore point added');
      void qc.invalidateQueries({ queryKey: qk.messages(convId ?? '') });
      void qc.invalidateQueries({ queryKey: qk.project(id) });
      void qc.invalidateQueries({ queryKey: qk.checkpoints(id) });
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setRestoreTarget(null);
    }
  };

  const streaming = !!turnJob && !isTerminal(turn);

  if (!flags.conversationThread) {
    return <ErrorView error={new Error('Chat history is not enabled for this project.')} title="Chat unavailable" />;
  }
  if (conversation.isLoading || messages.isLoading) return <LoadingView />;
  if (conversation.isError) return <ErrorView error={conversation.error} onRetry={() => conversation.refetch()} />;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <FlashList
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble m={item} projectId={id} onRestore={setRestoreTarget} />}
        maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2 }}
        onStartReached={() => messages.hasNextPage && !messages.isFetchingNextPage && messages.fetchNextPage()}
        contentContainerStyle={styles.list}
        ListHeaderComponent={messages.isFetchingNextPage ? <ActivityIndicator style={styles.pad} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="chat-processing-outline" size={40} color={theme.colors.primary} />
            <Text variant="titleMedium">Change anything by chatting</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
              “Make the header sticky”, “add a dark mode toggle”, “why is login failing?”
            </Text>
          </View>
        }
        ListFooterComponent={
          streaming ? (
            <Card mode="contained" style={styles.streamCard}>
              <Card.Content style={styles.gap}>
                {turn.agentSteps.slice(-4).map((s) => (
                  <View key={s.seq} style={styles.stepRow}>
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color={theme.colors.success} />
                    <Text variant="bodySmall">{s.label}</Text>
                  </View>
                ))}
                {turn.assistantText ? <MarkdownView>{turn.assistantText}</MarkdownView> : (
                  <View style={styles.stepRow}>
                    <ActivityIndicator size={14} />
                    <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>Thinking…</Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ) : null
        }
      />
      <View style={[styles.composer, { borderTopColor: theme.colors.border, paddingBottom: insets.bottom + 8, backgroundColor: theme.colors.background }]}>
        <View style={styles.modes}>
          {modes.map((m) => (
            <Chip key={m} selected={mode === m} showSelectedCheck={false} onPress={() => setMode(m)} compact style={mode === m ? { backgroundColor: theme.colors.primaryContainer } : undefined} accessibilityLabel={`${m} mode. ${MODE_HELP[m]}`}>
              {m[0]!.toUpperCase() + m.slice(1)}
            </Chip>
          ))}
        </View>
        <Text variant="labelSmall" style={{ color: theme.colors.textMuted }}>
          {MODE_HELP[mode]}
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            mode="outlined"
            dense
            multiline
            value={text}
            onChangeText={setText}
            placeholder={offline ? 'You’re offline' : 'Message'}
            style={styles.input}
            disabled={offline}
            maxLength={4000}
            accessibilityLabel="Message"
          />
          <IconButton icon="send" mode="contained" onPress={send} disabled={!text.trim() || sending || streaming || offline} loading={sending} accessibilityLabel="Send" size={24} />
        </View>
      </View>

      <ConfirmDialog
        visible={!!restoreTarget}
        title="Restore to here?"
        body="This adds a new restore point with the project as it was at this message. Nothing is deleted — you can restore forward again later."
        confirmLabel="Add restore point"
        onConfirm={restore}
        onDismiss={() => setRestoreTarget(null)}
      />
      <Portal>
        <Dialog visible={scopeSheet} onDismiss={() => setScopeSheet(false)}>
          <Dialog.Icon icon="layers-plus" />
          <Dialog.Title style={styles.center}>This needs a full app</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Your request needs a backend, database or auth, but this project is a website only. Upgrade to a full app to add them.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setScopeSheet(false)}>Not now</Button>
            <Button
              onPress={() => {
                setScopeSheet(false);
                useDraft.getState().update({ prompt: project.data?.description ?? project.data?.name ?? '', scope: 'fullApp', projectName: project.data?.name });
                router.push('/builder/idea');
              }}
            >
              Upgrade to full app
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12 },
  pad: { padding: 12 },
  empty: { alignItems: 'center', gap: 8, padding: 32 },
  bubbleRow: { marginVertical: 4, maxWidth: '88%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  inlineBtn: { marginTop: 8, alignSelf: 'flex-start' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  metaBtn: { fontSize: 11, marginVertical: 2 },
  streamCard: { marginTop: 8 },
  gap: { gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  modes: { flexDirection: 'row', gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  input: { flex: 1, maxHeight: 140 },
  center: { textAlign: 'center' },
});
