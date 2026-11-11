import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

import { ApiError, errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints/auth';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { SocialAuthButtons } from '@/features/auth/AuthButtons';
import { AuthFooter, AuthHeader, FormAlert, Grow, OrDivider, PasswordChecklist, TermsCheckbox } from '@/features/auth/AuthLayout';
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { useSession } from '@/stores/session';

export default function SignUp() {
  const { t } = useTranslation();
  const signIn = useSession((s) => s.signIn);
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, formState, setFocus, setError, getFieldState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false },
    // Don't nag while typing the first time: validate when a field is left, then live while fixing it.
    mode: 'onTouched',
  });
  const password = useWatch({ control, name: 'password' });
  const passwordState = getFieldState('password', formState);

  const onSubmit = handleSubmit(
    async ({ name, email, password: pw }) => {
      setFormError(null);
      try {
        const session = await authApi.register({ name: name.trim(), email: email.trim().toLowerCase(), password: pw });
        haptics.success();
        await signIn(session);
        track('sign_up', { method: 'email' });
      } catch (e) {
        haptics.error();
        if (e instanceof ApiError && e.isConflict) {
          // Put it on the field that caused it, not in a generic banner.
          setError('email', { message: 'An account with this email already exists. Sign in instead?' }, { shouldFocus: true });
        } else {
          setFormError(errorMessage(e));
        }
      }
    },
    () => haptics.error(),
  );

  return (
    <Screen keyboard contentStyle={styles.content}>
      <AuthHeader title={t('auth.signUpTitle')} body={t('auth.signUpBody')} />

      <SocialAuthButtons />
      <OrDivider label={t('auth.orEmail')} />

      <View style={styles.form}>
        <FormField
          control={control}
          name="name"
          label={t('auth.fullName')}
          icon="account-outline"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => setFocus('email')}
        />
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
        <View>
          <FormField
            control={control}
            name="password"
            label={t('common.password')}
            icon="lock-outline"
            secure
            hideError
            autoComplete="new-password"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
          <PasswordChecklist value={password ?? ''} showErrors={(passwordState.isTouched || formState.isSubmitted) && !!passwordState.error} />
        </View>

        <Controller
          control={control}
          name="acceptTerms"
          render={({ field: { value, onChange }, fieldState: { error } }) => <TermsCheckbox checked={value} onChange={onChange} error={error?.message} />}
        />

        {formError ? <FormAlert message={formError} /> : null}

        <Button
          mode="contained"
          onPress={() => void onSubmit()}
          loading={formState.isSubmitting}
          disabled={formState.isSubmitting}
          contentStyle={styles.btn}
          style={styles.submit}
          accessibilityHint="Creates your account and signs you in"
        >
          {formState.isSubmitting ? t('auth.creatingAccount') : t('auth.signUp')}
        </Button>
      </View>

      <Grow />
      <AuthFooter prompt={t('auth.haveAccountPrompt')} action={t('auth.signIn')} onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  form: { gap: 8 },
  submit: { marginTop: 4 },
  btn: { minHeight: 52 },
});
