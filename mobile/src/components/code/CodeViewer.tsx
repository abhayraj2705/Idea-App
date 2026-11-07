import { FlashList } from '@shopify/flash-list';
import { memo, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useAppTheme, type AppTheme } from '@/theme/theme';

import { tokenizeLines, type Token, type TokenKind } from './highlight';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const FONT_SIZE = 13;
const LINE_HEIGHT = 20;
const CHAR_WIDTH = 7.9;

function colorFor(theme: AppTheme, kind: TokenKind) {
  switch (kind) {
    case 'keyword':
      return theme.colors.primary;
    case 'string':
      return theme.colors.success;
    case 'comment':
      return theme.colors.textSubtle;
    case 'number':
      return theme.colors.info;
    case 'tag':
    case 'type':
      return theme.colors.warning;
    default:
      return theme.colors.onSurface;
  }
}

const Line = memo(function Line({
  n,
  tokens,
  gutter,
  theme,
  highlight,
}: {
  n: number;
  tokens: Token[];
  gutter: number;
  theme: AppTheme;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.line, highlight && { backgroundColor: theme.colors.primaryContainer }]}>
      <Text
        style={[styles.gutter, { width: gutter, color: theme.colors.textSubtle }]}
        allowFontScaling={false}
        importantForAccessibility="no"
      >
        {n}
      </Text>
      <Text style={[styles.code, { color: theme.colors.onSurface }]} allowFontScaling={false} selectable>
        {tokens.length === 0
          ? ' '
          : tokens.map((t, i) => (
              <Text key={i} style={[{ color: colorFor(theme, t.kind) }, t.kind === 'comment' && styles.italic]}>
                {t.text}
              </Text>
            ))}
      </Text>
    </View>
  );
});

/** Read-only, virtualised code viewer with line numbers and horizontal scroll (§7.5). */
export function CodeViewer({
  code,
  language,
  highlightLines,
}: {
  code: string;
  language: string;
  highlightLines?: Set<number>;
}) {
  const theme = useAppTheme();
  const lines = useMemo(() => tokenizeLines(code, language), [code, language]);
  const longest = useMemo(() => code.split('\n').reduce((m, l) => Math.max(m, l.length), 0), [code]);
  const gutter = String(lines.length).length * CHAR_WIDTH + 16;
  const width = Math.max(320, gutter + longest * CHAR_WIDTH + 32);
  const data = useMemo(() => lines.map((tokens, i) => ({ n: i + 1, tokens })), [lines]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.codeBackground }]} accessibilityLabel={`Code, ${lines.length} lines`}>
      <ScrollView horizontal showsHorizontalScrollIndicator bounces={false}>
        <View style={{ width, flex: 1 }}>
          <FlashList
            data={data}
            keyExtractor={(item) => String(item.n)}
            renderItem={({ item }) => (
              <Line n={item.n} tokens={item.tokens} gutter={gutter} theme={theme} highlight={highlightLines?.has(item.n)} />
            )}
            contentContainerStyle={styles.content}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingVertical: 8 },
  line: { flexDirection: 'row', minHeight: LINE_HEIGHT, paddingRight: 16 },
  gutter: { fontFamily: MONO, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, textAlign: 'right', paddingRight: 12 },
  code: { fontFamily: MONO, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT },
  italic: { fontStyle: 'italic' },
});
