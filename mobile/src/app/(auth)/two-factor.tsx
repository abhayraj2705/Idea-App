import { zodResolver } from '@hookform/resolvers/zod';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, HelperText, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { codeSchema } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { useSession } from '@/stores/session';
import { useAppTheme } from '@/theme/theme';

export default function TwoFactor() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const tempToken = useSession((s) => s.pendingTwoFactor);
  const signIn = useSession((s) => s.signIn);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  if (!tempToken) return <Redirect href="/sign-in" />;

  const onSubmit = handleSubmit(async ({ code }) => {
    setError(null);
    try {
      const session = await authApi.verify2fa({ tempToken, code });
      await signIn(session);
      track('login', { method: 'email_2fa' });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <Text variant="headlineMedium" accessibilityRole="header">
        {t('auth.twoFactorTitle')}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        {t('auth.twoFactorBody')}
      </Text>
      <FormField
        control={control}
        name="code"
        label="Code"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        onSubmitEditing={() => void onSubmit()}
      />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
        {t('auth.verify')}
      </Button>
    </Screen>
  );
}
