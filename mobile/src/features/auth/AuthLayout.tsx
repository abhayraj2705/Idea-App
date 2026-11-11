import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, HelperText, Text } from 'react-native-paper';

import { useTranslation } from '@/i18n';
import { legalUrls } from '@/lib/config';
import { font } from '@/theme/fonts';
import { radius } from '@/theme/radius';
import { useAppTheme } from '@/theme/theme';

import { PASSWORD_RULES } from './schemas';

/** Title + one line of context at the top of an auth form. */
export function AuthHeader({ title, body }: { title: string; body?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.header}>
      <Text variant="headlineMedium" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

/** Hairline rule with a centred label ("or" by default), between the email form and social sign-in. */
export function OrDivider({ label }: { label?: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.or} importantForAccessibility="no-hide-descendants">
      <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
      <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
        {label ?? t('auth.or')}
      </Text>
      <View style={[styles.rule, { backgroundColor: theme.colors.border }]} />
    </View>
  );
}

/** "Don't have an account? Create one" — only the action is emphasised. */
export function AuthFooter({ prompt, action, onPress }: { prompt: string; action: string; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={[styles.footer, { color: theme.colors.textMuted }]}>
      {prompt}{' '}
      <Text variant="bodyMedium" style={[styles.footerAction, { color: theme.colors.primary }]} onPress={onPress} accessibilityRole="link" suppressHighlighting={false}>
        {action}
      </Text>
    </Text>
  );
}

/** Form-level error (network, server, rate limit) shown above the submit button. */
export function FormAlert({ message }: { message: string }) {
  const theme = useAppTheme();
  return (
    <View style={[styles.alert, { backgroundColor: theme.colors.errorContainer }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <MaterialCommunityIcons name="alert-circle-outline" size={18} color={theme.colors.error} style={styles.alertIcon} />
      <Text variant="bodyMedium" style={[styles.flex, { color: theme.colors.onErrorContainer }]}>
        {message}
      </Text>
    </View>
  );
}

/**
 * Live password requirements. Each rule ticks as it's met; once the field has
 * been touched, unmet rules turn red so the user knows exactly what's missing.
 */
export function PasswordChecklist({ value, showErrors }: { value: string; showErrors: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={styles.rules} accessibilityRole="summary" accessibilityLabel={`Password requirements: ${PASSWORD_RULES.map((r) => `${r.label}, ${r.test(value) ? 'met' : 'not met'}`).join('; ')}`}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const color = met ? theme.colors.success : showErrors ? theme.colors.error : theme.colors.textMuted;
        return (
          <View key={rule.label} style={styles.rule2} importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons name={met ? 'check-circle' : 'circle-outline'} size={14} color={color} />
            <Text variant="bodySmall" style={{ color: met ? theme.colors.onSurface : color }}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Required consent checkbox with links to the legal pages. */
export function TermsCheckbox({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const theme = useAppTheme();
  const link = [styles.link, { color: theme.colors.onSurface }];
  return (
    <View>
      <Pressable
        onPress={() => onChange(!checked)}
        style={styles.terms}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
      >
        {/* Android variant on every platform: the iOS one has no box, so "unchecked" was invisible. */}
        <Checkbox.Android status={checked ? 'checked' : 'unchecked'} onPress={() => onChange(!checked)} color={theme.colors.primary} uncheckedColor={error ? theme.colors.error : theme.colors.textMuted} />
        <Text variant="bodyMedium" style={[styles.flex, { color: theme.colors.textMuted }]}>
          I agree to the{' '}
          <Text variant="bodyMedium" style={link} onPress={() => WebBrowser.openBrowserAsync(legalUrls.terms)} accessibilityRole="link">
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text variant="bodyMedium" style={link} onPress={() => WebBrowser.openBrowserAsync(legalUrls.privacy)} accessibilityRole="link">
            Privacy Policy
          </Text>
        </Text>
      </Pressable>
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

/** Spacer that pushes the footer to the bottom of a short form. */
export function Grow({ children }: { children?: ReactNode }) {
  return <View style={styles.grow}>{children}</View>;
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 8 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { textAlign: 'center', paddingVertical: 8 },
  footerAction: { fontFamily: font.semibold },
  grow: { flexGrow: 1 },
  flex: { flex: 1 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: radius.control },
  alertIcon: { marginTop: 2 },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2 },
  rule2: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: -8 },
  link: { textDecorationLine: 'underline' },
});
