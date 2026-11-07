import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, HelperText, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { EmptyView } from '@/components/StateViews';
import { resetSchema } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { isValidToken } from '@/lib/deepLinks';

export default function ResetPassword() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ token?: string }>();
  // Capture once, then strip the token from navigation state (§10).
  const [token, setToken] = useState(() => (isValidToken(params.token) ? params.token : null));
  useEffect(() => {
    if (params.token) router.setParams({ token: undefined });
  }, [params.token]);

  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  if (!token && !done) {
    return (
      <Screen>
        <EmptyView icon="link-variant-off" title="This link is invalid or has expired" body="Request a new reset link and try again." />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <EmptyView
          icon="lock-check-outline"
          title={t('auth.passwordReset')}
          action={
            <Button mode="contained" onPress={() => router.replace('/sign-in')}>
              {t('auth.signIn')}
            </Button>
          }
        />
      </Screen>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authApi.resetPassword(token!, password);
      setToken(null);
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <Text variant="headlineMedium" accessibilityRole="header">
        {t('auth.setPassword')}
      </Text>
      <FormField control={control} name="password" label={t('auth.newPassword')} secure autoComplete="new-password" />
      <FormField control={control} name="confirm" label="Confirm password" secure autoComplete="new-password" />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
        {t('auth.setPassword')}
      </Button>
    </Screen>
  );
}
