import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, HelperText, List, Snackbar } from 'react-native-paper';

import { authApi, errorMessage } from '@/api';
import { FormField } from '@/components/FormField';
import { profileSchema as schema } from '@/features/auth/schemas';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { useSession } from '@/stores/session';

export default function Account() {
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const [snack, setSnack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { name: user?.name ?? '' } });

  const onSubmit = handleSubmit(async ({ name }) => {
    setError(null);
    try {
      setUser(await authApi.updateProfile({ name }));
      setSnack('Profile saved');
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <FormField control={control} name="name" label="Name" autoComplete="name" />
      {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      <Button mode="contained" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting || !formState.isDirty}>
        Save
      </Button>
      <List.Item
        title="Email"
        description={user?.email}
        left={(p) => <List.Icon {...p} icon="email-outline" />}
        right={() => <StatusChip status={user?.emailVerified ? 'complete' : 'partial'} label={user?.emailVerified ? 'Verified' : 'Unverified'} compact />}
      />
      {!user?.emailVerified ? (
        <Button
          icon="email-send-outline"
          loading={resending}
          onPress={async () => {
            setResending(true);
            try {
              await authApi.resendVerification();
              setSnack('Verification email sent');
            } catch (e) {
              setSnack(errorMessage(e));
            } finally {
              setResending(false);
            }
          }}
        >
          Resend verification email
        </Button>
      ) : null}
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </Screen>
  );
}
