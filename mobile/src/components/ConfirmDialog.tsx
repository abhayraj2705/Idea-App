import { useState } from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { useAppTheme } from '@/theme/theme';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onDismiss: () => void;
};

export function ConfirmDialog({ visible, title, body, confirmLabel, destructive, onConfirm, onDismiss }: Props) {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={busy ? undefined : onDismiss}>
        <Dialog.Title>{title}</Dialog.Title>
        {body ? (
          <Dialog.Content>
            <Text variant="bodyMedium">{body}</Text>
          </Dialog.Content>
        ) : null}
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={busy}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={busy}
            textColor={destructive ? theme.colors.error : undefined}
            onPress={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
