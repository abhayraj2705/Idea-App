import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Snackbar, Text } from 'react-native-paper';

import { aiApi, errorMessage } from '@/api';
import { CodeViewer } from '@/components/code/CodeViewer';
import { MarkdownView } from '@/components/MarkdownView';
import { EmptyView, LoadingView } from '@/components/StateViews';
import { useProject } from '@/features/queries';
import { languageFromPath } from '@/lib/format';
import { useAppTheme } from '@/theme/theme';

/** Read-only code viewer with Copy, Share and Explain (§7.5). */
export default function FileScreen() {
  const { id, path } = useLocalSearchParams<{ id: string; path: string }>();
  const theme = useAppTheme();
  const project = useProject(id);
  const [snack, setSnack] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const file = project.data?.files?.find((f) => f.path === path);
  const name = path?.split('/').pop() ?? 'File';

  if (project.isLoading) return <LoadingView />;
  if (!file) return <EmptyView icon="file-hidden" title="File not found" body={path} />;

  const explain = async () => {
    setExplaining(true);
    try {
      const res = await aiApi.explain({ projectId: id, path: file.path });
      setExplanation(res.explanation);
    } catch (e) {
      setSnack(errorMessage(e));
    } finally {
      setExplaining(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <View style={styles.actions}>
              <IconButton
                icon="content-copy"
                accessibilityLabel="Copy file"
                onPress={async () => {
                  await Clipboard.setStringAsync(file.content);
                  setSnack('Copied');
                }}
              />
              <IconButton icon="share-variant-outline" accessibilityLabel="Share file" onPress={() => Share.share({ message: file.content, title: file.path })} />
            </View>
          ),
        }}
      />
      <View style={[styles.pathBar, { borderBottomColor: theme.colors.border }]}>
        <Text variant="labelMedium" numberOfLines={1} style={[styles.flex, { color: theme.colors.textMuted }]}>
          {file.path}
        </Text>
        <Button compact icon="lightbulb-on-outline" loading={explaining} disabled={explaining} onPress={explain}>
          Explain
        </Button>
      </View>
      <CodeViewer code={file.content} language={languageFromPath(file.path)} />
      <Portal>
        <Dialog visible={!!explanation} onDismiss={() => setExplanation(null)} style={styles.dialog}>
          <Dialog.Title>About {name}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView contentContainerStyle={styles.dialogBody}>
              <MarkdownView>{explanation ?? ''}</MarkdownView>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setExplanation(null)}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row' },
  pathBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  dialog: { maxHeight: '80%' },
  dialogBody: { paddingVertical: 12 },
});
