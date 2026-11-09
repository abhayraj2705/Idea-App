import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Text } from 'react-native-paper';

import { LogoMark } from '@/components/brand/Logo';
import { Screen } from '@/components/Screen';
import type { IconName } from '@/components/StateViews';
import { SocialAuthButtons } from '@/features/auth/AuthButtons';
import { useTranslation } from '@/i18n';
import { legalUrls } from '@/lib/config';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';
import { font } from '@/theme/fonts';

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const reason = useSession((s) => s.signOutReason);
  const enterGuest = useSession((s) => s.enterGuest);

  const props: { icon: IconName; text: string }[] = [
    { icon: 'text-box-edit-outline', text: t('auth.valueProps.one') },
    { icon: 'bell-ring-outline', text: t('auth.valueProps.two') },
    { icon: 'rocket-launch-outline', text: t('auth.valueProps.three') },
  ];

  return (
    <Screen edges={['top', 'bottom']}>
      <Banner visible={reason === 'expired' || reason === 'deleted'} icon={reason === 'deleted' ? 'account-remove' : 'clock-alert-outline'}>
        {reason === 'deleted' ? t('auth.accountDeleted') : t('auth.sessionExpired')}
      </Banner>
      <View style={styles.hero}>
        <View style={styles.logo}>
          <LogoMark size={72} />
        </View>
        <Text variant="displaySmall" style={styles.title} accessibilityRole="header">
          IDEA
        </Text>
        <Text variant="titleMedium" style={[styles.center, { color: theme.colors.textMuted }]}>
          {t('auth.tagline')}
        </Text>
      </View>

      <View style={styles.props}>
        {props.map((p) => (
          <View key={p.icon} style={styles.prop}>
            <View style={[styles.propIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name={p.icon} size={20} color={theme.colors.primary} />
            </View>
            <Text variant="bodyLarge" style={styles.flex}>
              {p.text}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <SocialAuthButtons />
        <Button mode="contained" icon="email-outline" onPress={() => router.push('/sign-up')} contentStyle={styles.btn}>
          {t('auth.continueEmail')}
        </Button>
        <Button onPress={() => router.push('/sign-in')}>{t('auth.haveAccount')}</Button>
        <Button
          compact
          textColor={theme.colors.textMuted}
          onPress={() => {
            enterGuest();
            router.replace('/builder/idea');
          }}
        >
          Try it without an account
        </Button>
      </View>

      <Text variant="bodySmall" style={[styles.center, { color: theme.colors.textMuted }]}>
        By continuing you agree to our{' '}
        <Text variant="bodySmall" style={{ color: theme.colors.primary }} onPress={() => WebBrowser.openBrowserAsync(legalUrls.terms)} accessibilityRole="link">
          Terms
        </Text>{' '}
        and{' '}
        <Text variant="bodySmall" style={{ color: theme.colors.primary }} onPress={() => WebBrowser.openBrowserAsync(legalUrls.privacy)} accessibilityRole="link">
          Privacy Policy
        </Text>
        .
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, paddingTop: 24 },
  logo: { marginBottom: 8 },
  title: { fontFamily: font.extrabold, letterSpacing: 1 },
  center: { textAlign: 'center' },
  props: { gap: 14, paddingVertical: 8 },
  prop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  propIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  actions: { gap: 12 },
  btn: { minHeight: 48 },
});
