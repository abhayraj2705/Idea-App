import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, HelperText, Text } from 'react-native-paper';

import { authApi } from '@/api/endpoints/auth';
import { errorMessage } from '@/api/client';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { forgotSchema } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { useAppTheme } from '@/theme/theme';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <Text variant="headlineMedium" accessibilityRole="header">
        {t('auth.forgotTitle')}
      </Text>
      <Text variant="bodyMedium" style={{ color: theme.colors.textMuted }}>
        {t('auth.forgotBody')}
      </Text>
      <FormField control={control} name="email" label={t('common.email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      {sent ? (
        <HelperText type="info" visible>
          {t('auth.linkSent')}
        </HelperText>
      ) : null}
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
        {t('auth.sendLink')}
      </Button>
    </Screen>
  );
}
