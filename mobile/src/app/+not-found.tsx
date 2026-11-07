import { router } from 'expo-router';
import { Button } from 'react-native-paper';

import { Screen } from '@/components/Screen';
import { EmptyView } from '@/components/StateViews';

export default function NotFound() {
  return (
    <Screen scroll={false}>
      <EmptyView
        icon="map-marker-question-outline"
        title="This screen doesn’t exist"
        action={
          <Button mode="contained" onPress={() => router.replace('/')}>
            Go home
          </Button>
        }
      />
    </Screen>
  );
}
