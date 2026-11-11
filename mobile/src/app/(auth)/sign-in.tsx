import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { SocialAuthButtons } from '@/features/auth/AuthButtons';
import { AuthFooter, AuthHeader, FormAlert, Grow, OrDivider } from '@/features/auth/AuthLayout';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function SignIn() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const signIn = useSession((s) => s.signIn);
  const setPending = useSession((s) => s.setPendingTwoFactor);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setFocus } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await authApi.login({ email: values.email.trim().toLowerCase(), password: values.password });
      if ('twoFactorRequired' in res) {
        // Without the challenge token the 2FA screen can't verify and would bounce straight back here.
        if (!res.tempToken) throw new Error('Two-factor sign-in could not start. Please try again.');
        setPending(res.tempToken);
        router.push('/two-factor');
        return;
      }
      await signIn(res);
      track('login', { method: 'email' });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard contentStyle={styles.content}>
      <AuthHeader title={t('auth.signInTitle')} body={t('auth.signInBody')} />
      <View style={styles.form}>
        <FormField
          control={control}
          name="email"
          label={t('common.email')}
          icon="email-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => setFocus('password')}
        />
        <FormField
          control={control}
          name="password"
          label={t('common.password')}
          icon="lock-outline"
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
        />
        <Button compact style={styles.forgot} textColor={theme.colors.onSurface} onPress={() => router.push('/forgot-password')}>
          {t('auth.forgot')}
        </Button>
        {error ? <FormAlert message={error} /> : null}
        <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting} contentStyle={styles.btn}>
          {formState.isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </View>
      <OrDivider />
      <SocialAuthButtons />
      <Grow />
      <AuthFooter prompt={t('auth.noAccountPrompt')} action={t('auth.createOne')} onPress={() => router.replace('/sign-up')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  form: { gap: 4 },
  forgot: { alignSelf: 'flex-end', marginBottom: 8 },
  btn: { minHeight: 52 },
});
