import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { AuthFooter, AuthHeader, FormAlert, Grow } from '@/features/auth/AuthLayout';
import { codeSchema } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/stores/session';

export default function TwoFactor() {
  const { t } = useTranslation();
  const tempToken = useSession((s) => s.pendingTwoFactor);
  const signIn = useSession((s) => s.signIn);
  const setPending = useSession((s) => s.setPendingTwoFactor);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setValue } = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  // Only reachable mid-login; without the challenge token there is nothing to verify.
  if (!tempToken) return <Redirect href="/sign-in" />;

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const session = await authApi.verify2fa({ tempToken, code });
      haptics.success();
      await signIn(session);
      track('login', { method: 'email_2fa' });
    } catch (e) {
      haptics.error();
      setValue('code', '');
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard contentStyle={styles.content}>
      <AuthHeader title={t('auth.twoFactorTitle')} body={t('auth.twoFactorBody')} />
      <View style={styles.form}>
        <FormField
          control={control}
          name="code"
          label={t('auth.code')}
          icon="shield-key-outline"
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
        />
        {error ? <FormAlert message={error} /> : null}
        <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting} contentStyle={styles.btn}>
          {formState.isSubmitting ? t('auth.verifying') : t('auth.verify')}
        </Button>
      </View>
      <Grow />
      <AuthFooter
        prompt={t('auth.wrongAccount')}
        action={t('auth.backToSignIn')}
        onPress={() => {
          setPending(null);
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  form: { gap: 8 },
  btn: { minHeight: 52 },
});
