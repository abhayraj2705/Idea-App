import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';

import { aiApi } from '@/api/endpoints/ai';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useDraft } from '@/stores/draft';
import { useAppTheme } from '@/theme/theme';

/** Wireframe gate (§7.2): approve or regenerate before generation. */
export default function WireframeStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();
  const gen = useMutation({
    mutationFn: () => aiApi.wireframe({ prompt: draft.prompt, requirements: draft.requirements, stack: draft.stack }),
    onSuccess: (wireframe) => update({ wireframe, wireframeApproved: false }),
  });
  const loading = gen.isPending;
  const error = gen.error;
  const load = () => gen.mutate();

  useEffect(() => {
    if (!draft.wireframe) gen.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BuilderScaffold
      step="wireframe"
      title={t('builder.wireframeTitle')}
      subtitle="These are the screens we’ll build. Approve to continue."
      nextLabel={t('builder.approve')}
      nextDisabled={!draft.wireframe || loading}
      onNext={() => {
        update({ wireframeApproved: true });
        track('wireframe_approved');
      }}
      footerExtra={
        <Button mode="outlined" icon="refresh" onPress={load} disabled={loading}>
          {t('builder.regenerate')}
        </Button>
      }
    >
      {loading ? <LoadingView label="Sketching your screens…" /> : null}
      {error && !loading ? <ErrorView error={error} onRetry={load} /> : null}
      {!loading &&
        draft.wireframe?.screens.map((s, i) => (
          <Card key={`${s.name}-${i}`} mode="outlined" style={{ borderColor: theme.colors.border }}>
            <Card.Content style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.phone, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="cellphone-screenshot" size={22} color={theme.colors.textMuted} />
                </View>
                <View style={styles.flex}>
                  <Text variant="titleMedium">
                    {i + 1}. {s.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                    {s.description}
                  </Text>
                </View>
              </View>
              {s.elements?.length ? (
                <View style={styles.chips}>
                  {s.elements.map((el) => (
                    <Chip key={el} compact>
                      {el}
                    </Chip>
                  ))}
                </View>
              ) : null}
            </Card.Content>
          </Card>
        ))}
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  phone: { width: 44, height: 64, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
