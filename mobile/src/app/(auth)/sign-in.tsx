import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Divider, HelperText, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { SocialAuthButtons } from '@/features/auth/AuthButtons';
import { signInSchema, type SignInValues } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/stores/session';

export default function SignIn() {
  const { t } = useTranslation();
  const signIn = useSession((s) => s.signIn);
  const setPending = useSession((s) => s.setPendingTwoFactor);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const res = await authApi.login(values);
      if ('twoFactorRequired' in res) {
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
    <Screen keyboard>
      <Text variant="headlineMedium" accessibilityRole="header">
        {t('auth.signIn')}
      </Text>
      <View style={styles.form}>
        <FormField control={control} name="email" label={t('common.email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <FormField control={control} name="password" label={t('common.password')} secure autoComplete="current-password" textContentType="password" onSubmitEditing={() => void onSubmit()} />
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting} contentStyle={styles.btn}>
          {t('auth.signIn')}
        </Button>
        <Button onPress={() => router.push('/forgot-password')}>{t('auth.forgot')}</Button>
      </View>
      <Divider />
      <SocialAuthButtons />
      <Button onPress={() => router.replace('/sign-up')}>{t('auth.noAccount')}</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: 8 }, btn: { minHeight: 48 } });
