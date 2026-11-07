import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  keyboard?: boolean;
  /** Which safe-area edges to pad. Screens under a native header usually only need bottom. */
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Base screen container: themed background, safe-area insets (edge-to-edge on
 * Android), keyboard-safe layout and pull-to-refresh.
 */
export function Screen({
  children,
  scroll = true,
  padded = true,
  keyboard = false,
  edges = ['bottom'],
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  testID,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
  const bottom = edges.includes('bottom') ? insets.bottom : 0;
  const inner = [padded && styles.padded, contentStyle];

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[inner, { paddingBottom: (footer ? 0 : bottom) + 24 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, inner]}>{children}</View>
  );

  const content = (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }, pad]} testID={testID}>
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: bottom + 12, borderTopColor: theme.colors.border, backgroundColor: theme.colors.background },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );

  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
});
