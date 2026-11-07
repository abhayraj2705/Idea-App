import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function SignUp() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const signIn = useSession((s) => s.signIn);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const session = await authApi.register(values);
      await signIn(session);
      track('sign_up', { method: 'email' });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <Text variant="headlineMedium" accessibilityRole="header">
        {t('auth.signUp')}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        We’ll send a link to verify your email.
      </Text>
      <View style={styles.form}>
        <FormField control={control} name="name" label={t('common.name')} autoComplete="name" textContentType="name" />
        <FormField control={control} name="email" label={t('common.email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <FormField control={control} name="password" label={t('common.password')} secure autoComplete="new-password" textContentType="newPassword" />
        <HelperText type="info" visible>
          At least 8 characters with a letter and a number.
        </HelperText>
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting} contentStyle={styles.btn}>
          {t('auth.signUp')}
        </Button>
        <Button onPress={() => router.replace('/sign-in')}>{t('auth.haveAccount')}</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: 8 }, btn: { minHeight: 48 } });
