import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Text } from 'react-native-paper';

import { LogoMark } from '@/components/brand/Logo';
import { Screen } from '@/components/Screen';
import { SocialAuthButtons } from '@/features/auth/AuthButtons';
import { useTranslation } from '@/i18n';
import { legalUrls } from '@/lib/config';
import { useSession } from '@/stores/session';
import { font } from '@/theme/fonts';
import { useAppTheme } from '@/theme/theme';

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const reason = useSession((s) => s.signOutReason);
  const enterGuest = useSession((s) => s.enterGuest);

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <Banner visible={reason === 'expired' || reason === 'deleted'} icon={reason === 'deleted' ? 'account-remove' : 'clock-alert-outline'}>
        {reason === 'deleted' ? t('auth.accountDeleted') : t('auth.sessionExpired')}
      </Banner>

      <View style={styles.hero}>
        <LogoMark size={56} />
        <Text variant="displaySmall" style={styles.wordmark} accessibilityRole="header">
          IDEA
        </Text>
        <Text variant="titleMedium" style={[styles.center, { color: theme.colors.onSurface }]}>
          {t('auth.tagline')}
        </Text>
        <Text variant="bodyMedium" style={[styles.center, styles.lede, { color: theme.colors.textMuted }]}>
          {t('auth.lede')}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button mode="contained" onPress={() => router.push('/sign-up')} contentStyle={styles.btn}>
          {t('auth.signUp')}
        </Button>
        <SocialAuthButtons />
        <Button mode="text" textColor={theme.colors.onSurface} onPress={() => router.push('/sign-in')} contentStyle={styles.btn}>
          {t('auth.signIn')}
        </Button>
        <Button
          compact
          textColor={theme.colors.textMuted}
          onPress={() => {
            enterGuest();
            router.replace('/builder/idea');
          }}
        >
          {t('auth.tryAsGuest')}
        </Button>

        <Text variant="bodySmall" style={[styles.center, styles.legal, { color: theme.colors.textMuted }]}>
          By continuing you agree to the{' '}
          <Text variant="bodySmall" style={[styles.link, { color: theme.colors.onSurface }]} onPress={() => WebBrowser.openBrowserAsync(legalUrls.terms)} accessibilityRole="link">
            Terms
          </Text>{' '}
          and{' '}
          <Text variant="bodySmall" style={[styles.link, { color: theme.colors.onSurface }]} onPress={() => WebBrowser.openBrowserAsync(legalUrls.privacy)} accessibilityRole="link">
            Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Brand in the upper half, actions anchored to the bottom where thumbs reach.
  content: { flexGrow: 1, justifyContent: 'space-between' },
  hero: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 32 },
  wordmark: { fontFamily: font.extrabold, letterSpacing: 2, marginTop: 8 },
  center: { textAlign: 'center' },
  lede: { maxWidth: 300 },
  actions: { gap: 10 },
  btn: { minHeight: 48 },
  legal: { marginTop: 8 },
  link: { textDecorationLine: 'underline' },
});
