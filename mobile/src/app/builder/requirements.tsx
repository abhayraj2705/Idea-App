import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, IconButton, SegmentedButtons, TextInput } from 'react-native-paper';

import { aiApi } from '@/api/endpoints/ai';
import { errorMessage } from '@/api/client';
import type { Requirement } from '@/api/types';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { uuid } from '@/lib/format';
import { useDraft } from '@/stores/draft';
import { useAppTheme } from '@/theme/theme';

export default function RequirementsStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const gen = useMutation({
    mutationFn: () => aiApi.requirements({ prompt: draft.prompt, stack: draft.stack, scope: draft.scope }),
    onSuccess: (res) => {
      const current = useDraft.getState().draft;
      update({ requirements: res.requirements, projectName: current.projectName ?? res.projectName });
    },
  });
  const loading = gen.isPending;
  const error = gen.error;
  const load = () => gen.mutate();

  useEffect(() => {
    if (!draft.requirements.length) gen.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (id: string, patch: Partial<Requirement>) =>
    update({ requirements: draft.requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const remove = (id: string) => update({ requirements: draft.requirements.filter((r) => r.id !== id) });
  const add = () => update({ requirements: [...draft.requirements, { id: uuid(), title: '', priority: 'should' }] });

  const suggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await aiApi.suggestRequirements({ prompt: draft.prompt, requirements: draft.requirements });
      const existing = new Set(draft.requirements.map((r) => r.title.toLowerCase()));
      update({ requirements: [...draft.requirements, ...res.requirements.filter((r) => !existing.has(r.title.toLowerCase()))] });
    } catch (e) {
      setSuggestError(errorMessage(e));
    } finally {
      setSuggesting(false);
    }
  };

  const valid = draft.requirements.filter((r) => r.title.trim()).length > 0;

  return (
    <BuilderScaffold
      step="requirements"
      title={t('builder.requirementsTitle')}
      subtitle={t('builder.requirementsBody')}
      nextDisabled={!valid || loading}
      onNext={() => {
        update({ requirements: draft.requirements.filter((r) => r.title.trim()), wireframe: undefined, wireframeApproved: false });
        track('requirements_confirmed', { count: draft.requirements.length });
      }}
    >
      <TextInput mode="outlined" label="Project name" value={draft.projectName ?? ''} onChangeText={(projectName) => update({ projectName })} maxLength={60} />
      {loading ? <LoadingView label="Turning your idea into requirements…" /> : null}
      {error && !loading ? <ErrorView error={error} onRetry={load} /> : null}
      {draft.requirements.map((r, i) => (
        <Card key={r.id} mode="outlined" style={{ borderColor: theme.colors.border }}>
          <Card.Content style={styles.card}>
            <View style={styles.row}>
              <TextInput
                mode="flat"
                dense
                value={r.title}
                onChangeText={(title) => edit(r.id, { title })}
                placeholder="Describe a requirement"
                style={styles.flex}
                multiline
                accessibilityLabel={`Requirement ${i + 1}`}
              />
              <IconButton icon="trash-can-outline" onPress={() => remove(r.id)} accessibilityLabel={`Remove requirement ${i + 1}`} />
            </View>
            <SegmentedButtons
              density="small"
              value={r.priority ?? 'should'}
              onValueChange={(v) => edit(r.id, { priority: v as Requirement['priority'] })}
              buttons={[
                { value: 'must', label: 'Must' },
                { value: 'should', label: 'Should' },
                { value: 'could', label: 'Could' },
              ]}
            />
          </Card.Content>
        </Card>
      ))}
      {!loading ? (
        <View style={styles.actions}>
          <Button mode="outlined" icon="plus" onPress={add}>
            {t('builder.addRequirement')}
          </Button>
          <Button mode="text" icon="auto-fix" onPress={suggest} loading={suggesting} disabled={suggesting}>
            {t('builder.suggestMore')}
          </Button>
        </View>
      ) : null}
      {suggestError ? (
        <HelperText type="error" visible>
          {suggestError}
        </HelperText>
      ) : null}
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, backgroundColor: 'transparent' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
