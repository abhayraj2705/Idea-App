import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, List, Switch, Text, TouchableRipple } from 'react-native-paper';

import { kindIcon } from '@/components/Cards';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { StatusChip } from '@/components/StatusChip';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useCapabilities } from '@/features/queries';
import { useTranslation } from '@/i18n';
import { useDraft } from '@/stores/draft';
import { usePrefs } from '@/stores/prefs';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function StackStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();
  const caps = useCapabilities();
  const showExperimental = usePrefs((s) => s.showExperimentalStacks);
  const setPrefs = usePrefs((s) => s.set);
  const defaultStack = useSession((s) => s.user?.defaultStack);

  const stacks = (caps.data?.stacks ?? []).filter(
    (s) => (showExperimental || s.status !== 'experimental') && (draft.scope !== 'website' || s.kind !== 'mobile'),
  );

  useEffect(() => {
    if (!draft.stack && stacks.length) {
      update({ stack: stacks.find((s) => s.id === defaultStack)?.id ?? stacks[0]?.id });
    }
  }, [stacks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BuilderScaffold step="stack" title={t('builder.stackTitle')} nextDisabled={!draft.stack}>
      {caps.isLoading ? <LoadingView /> : null}
      {caps.isError ? <ErrorView error={caps.error} onRetry={() => caps.refetch()} /> : null}
      <View style={styles.list} accessibilityRole="radiogroup">
        {stacks.map((s) => {
          const selected = draft.stack === s.id;
          return (
            <TouchableRipple
              key={s.id}
              onPress={() => update({ stack: s.id })}
              borderless
              style={[styles.card, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${s.name}, ${s.status}`}
            >
              <View style={styles.inner}>
                <View style={styles.row}>
                  <MaterialCommunityIcons name={kindIcon(s.kind)} size={22} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={styles.flex}>
                    {s.name}
                  </Text>
                  <StatusChip status={s.status} compact />
                </View>
                {s.description ? (
                  <Text variant="bodySmall" style={{ color: theme.colors.textMuted }}>
                    {s.description}
                  </Text>
                ) : null}
                {s.capabilities?.length ? (
                  <View style={styles.chips}>
                    {s.capabilities.slice(0, 6).map((c) => (
                      <Chip key={c} compact style={styles.chip} textStyle={styles.chipText}>
                        {c}
                      </Chip>
                    ))}
                  </View>
                ) : null}
              </View>
            </TouchableRipple>
          );
        })}
      </View>
      <List.Item
        title={t('builder.showExperimental')}
        description="Experimental stacks may produce incomplete apps."
        right={() => <Switch value={showExperimental} onValueChange={(v) => setPrefs({ showExperimentalStacks: v })} />}
        onPress={() => setPrefs({ showExperimentalStacks: !showExperimental })}
      />
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 14 },
  inner: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 28 },
  chipText: { fontSize: 11, marginVertical: 0 },
});
