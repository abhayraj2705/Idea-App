import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, Text } from 'react-native-paper';

import { errorMessage, projectsApi } from '@/api';
import { BrandArrowIcon } from '@/components/brand/Logo';
import { kindIcon } from '@/components/Cards';
import { Screen } from '@/components/Screen';
import { EmptyView, LoadingView } from '@/components/StateViews';
import { useTemplates } from '@/features/queries';
import { haptics } from '@/lib/haptics';
import { useDraft } from '@/stores/draft';
import { useAppTheme } from '@/theme/theme';

export default function TemplateDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const qc = useQueryClient();
  const templates = useTemplates();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = templates.data?.find((x) => x.id === id);

  if (templates.isLoading) return <LoadingView />;
  if (!t) return <EmptyView icon="view-grid-outline" title="Template not found" />;

  const clone = async () => {
    setBusy(true);
    setError(null);
    try {
      const project = await projectsApi.cloneTemplate(t.id);
      haptics.success();
      void qc.invalidateQueries({ queryKey: ['projects'] });
      router.replace(`/project/${project.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t.name }} />
      <Screen
        footer={
          <>
            <Button mode="contained" icon="content-copy" onPress={clone} loading={busy} disabled={busy}>
              Use this template
            </Button>
            {t.examplePrompt ? (
              <Button
                icon={BrandArrowIcon}
                onPress={() => {
                  useDraft.getState().update({ prompt: t.examplePrompt!, stack: t.stack, requirements: [], wireframe: undefined, wireframeApproved: false });
                  router.push('/builder/idea');
                }}
              >
                Start an idea like this
              </Button>
            ) : null}
          </>
        }
      >
        <View style={[styles.hero, { backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name={kindIcon(t.kind)} size={44} color={theme.colors.textMuted} />
        </View>
        <Text variant="headlineSmall">{t.name}</Text>
        {t.stack ? <Text variant="labelLarge" style={{ color: theme.colors.textMuted }}>{t.stack}</Text> : null}
        {t.description ? <Text variant="bodyLarge">{t.description}</Text> : null}
        {t.tags?.length ? (
          <View style={styles.chips}>
            {t.tags.map((tag) => (
              <Chip key={tag} compact>
                {tag}
              </Chip>
            ))}
          </View>
        ) : null}
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { height: 140, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
