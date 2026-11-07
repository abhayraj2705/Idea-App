import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple } from 'react-native-paper';

import type { GenerationScope } from '@/api/types';
import type { IconName } from '@/components/StateViews';
import { BuilderScaffold } from '@/features/builder/BuilderScaffold';
import { useTranslation } from '@/i18n';
import { useDraft } from '@/stores/draft';
import { useAppTheme } from '@/theme/theme';

export default function ScopeStep() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const { draft, update } = useDraft();

  const options: { value: GenerationScope; icon: IconName; title: string; body: string }[] = [
    { value: 'website', icon: 'web', title: t('builder.scopeWebsite'), body: t('builder.scopeWebsiteBody') },
    { value: 'fullApp', icon: 'layers-triple-outline', title: t('builder.scopeFull'), body: t('builder.scopeFullBody') },
  ];

  return (
    <BuilderScaffold step="scope" title={t('builder.scopeTitle')}>
      <View style={styles.list} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = draft.scope === o.value;
          return (
            <TouchableRipple
              key={o.value}
              onPress={() => update({ scope: o.value })}
              style={[styles.card, { borderColor: selected ? theme.colors.primary : theme.colors.border, backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              borderless
            >
              <View style={styles.row}>
                <MaterialCommunityIcons name={o.icon} size={28} color={theme.colors.primary} />
                <View style={styles.flex}>
                  <Text variant="titleMedium">{o.title}</Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
                    {o.body}
                  </Text>
                </View>
                <MaterialCommunityIcons name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={24} color={selected ? theme.colors.primary : theme.colors.textMuted} />
              </View>
            </TouchableRipple>
          );
        })}
      </View>
    </BuilderScaffold>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: { borderWidth: 1.5, borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flex: { flex: 1, gap: 2 },
});
