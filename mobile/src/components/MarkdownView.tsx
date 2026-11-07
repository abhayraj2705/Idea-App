import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { useAppTheme } from '@/theme/theme';

/** Assistant replies (parity with web ChatMarkdown.tsx). Links open in the in-app browser. */
export function MarkdownView({ children }: { children: string }) {
  const theme = useAppTheme();
  const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });
  return (
    <Markdown
      onLinkPress={(url) => {
        if (/^https:\/\//i.test(url)) void WebBrowser.openBrowserAsync(url);
        return false;
      }}
      style={{
        body: { color: theme.colors.onSurface, fontSize: 15, lineHeight: 22 },
        heading1: { fontSize: 20, fontWeight: '700', marginVertical: 6 },
        heading2: { fontSize: 18, fontWeight: '700', marginVertical: 6 },
        heading3: { fontSize: 16, fontWeight: '700', marginVertical: 4 },
        link: { color: theme.colors.primary },
        code_inline: {
          fontFamily: mono,
          backgroundColor: theme.colors.surfaceVariant,
          color: theme.colors.onSurface,
          borderRadius: 4,
          paddingHorizontal: 4,
        },
        fence: {
          fontFamily: mono,
          fontSize: 12,
          backgroundColor: theme.colors.codeBackground,
          color: theme.colors.onSurface,
          borderColor: theme.colors.border,
          borderRadius: 8,
          padding: 10,
        },
        code_block: {
          fontFamily: mono,
          fontSize: 12,
          backgroundColor: theme.colors.codeBackground,
          color: theme.colors.onSurface,
          borderRadius: 8,
          padding: 10,
        },
        blockquote: { backgroundColor: theme.colors.surfaceVariant, borderLeftColor: theme.colors.primary, borderLeftWidth: 3 },
        hr: { backgroundColor: theme.colors.border },
      }}
    >
      {children}
    </Markdown>
  );
}
