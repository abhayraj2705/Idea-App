import { useState } from 'react';
import { Button } from 'react-native-paper';

import { appConfigApi } from '@/api/endpoints/platform';
import { Screen } from '@/components/Screen';
import { EmptyView } from '@/components/StateViews';
import { useSession } from '@/stores/session';

export default function Maintenance() {
  const message = useSession((s) => s.appConfig?.maintenance?.message);
  const [checking, setChecking] = useState(false);
  return (
    <Screen edges={['top', 'bottom']} scroll={false}>
      <EmptyView
        icon="wrench-clock"
        title="We’ll be right back"
        body={message || 'IDEA is undergoing maintenance. Your projects are safe.'}
        action={
          <Button
            mode="outlined"
            icon="refresh"
            loading={checking}
            onPress={async () => {
              setChecking(true);
              try {
                useSession.getState().setAppConfig(await appConfigApi.get());
              } catch {
                // still down
              } finally {
                setChecking(false);
              }
            }}
          >
            Check again
          </Button>
        }
      />
    </Screen>
  );
}
