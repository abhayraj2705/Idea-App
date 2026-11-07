import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { FileDiff } from '@/api/types';
import { useAppTheme } from '@/theme/theme';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

/** Unified hunks only — no side-by-side on a phone (§7.4). */
export const FileDiffCard = memo(function FileDiffCard({ diff, initiallyOpen }: { diff: FileDiff; initiallyOpen?: boolean }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${diff.path}, ${diff.additions} additions, ${diff.deletions} deletions`}
      >
        <MaterialCommunityIcons
          name={diff.status === 'added' ? 'file-plus-outline' : diff.status === 'deleted' ? 'file-remove-outline' : 'file-document-edit-outline'}
          size={18}
          color={theme.colors.textMuted}
        />
        <Text variant="bodyMedium" numberOfLines={1} style={styles.path}>
          {diff.path}
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.success }}>
          +{diff.additions}
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.error }}>
          −{diff.deletions}
        </Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.textMuted} />
      </Pressable>
      {open ? (
        <ScrollView horizontal style={{ backgroundColor: theme.colors.codeBackground }}>
          <View style={styles.hunks}>
            {diff.hunks.map((h, hi) => (
              <View key={hi}>
                <Text style={[styles.mono, { color: theme.colors.info }]} allowFontScaling={false}>
                  {h.header}
                </Text>
                {h.lines.map((l, li) => (
                  <Text
                    key={li}
                    allowFontScaling={false}
                    style={[
                      styles.mono,
                      {
                        color: theme.colors.onSurface,
                        backgroundColor:
                          l.kind === 'add' ? theme.colors.diffAdd : l.kind === 'remove' ? theme.colors.diffRemove : 'transparent',
                      },
                    ]}
                  >
                    {l.kind === 'add' ? '+ ' : l.kind === 'remove' ? '- ' : '  '}
                    {l.text}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 48 },
  path: { flex: 1 },
  hunks: { paddingVertical: 8, paddingHorizontal: 8, minWidth: '100%' },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
});
