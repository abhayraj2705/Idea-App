import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, HelperText, SegmentedButtons, Text } from 'react-native-paper';

import { errorMessage, teamsApi, type TeamRole } from '@/api';
import { FormField } from '@/components/FormField';
import { Screen } from '@/components/Screen';
import { inviteSchema as schema } from '@/features/auth/schemas';
import { qk } from '@/features/queries';
import { haptics } from '@/lib/haptics';

export default function Invite() {
  const qc = useQueryClient();
  const [role, setRole] = useState<TeamRole>('member');
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await teamsApi.invite(email, role);
      haptics.success();
      await qc.invalidateQueries({ queryKey: qk.team });
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen keyboard>
      <Text variant="bodyMedium">They’ll get an email with a link that opens the app.</Text>
      <FormField control={control} name="email" label="Email" keyboardType="email-address" autoCapitalize="none" autoFocus />
      <SegmentedButtons
        value={role}
        onValueChange={(v) => setRole(v as TeamRole)}
        buttons={[
          { value: 'member', label: 'Member', icon: 'account-outline' },
          { value: 'admin', label: 'Admin', icon: 'shield-account-outline' },
        ]}
      />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
      <Button mode="contained" icon="send" onPress={() => void onSubmit()} loading={formState.isSubmitting} disabled={formState.isSubmitting}>
        Send invite
      </Button>
    </Screen>
  );
}
