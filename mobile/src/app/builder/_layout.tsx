import { router, Stack } from 'expo-router';
import { IconButton } from 'react-native-paper';

import { headerOptions } from '@/theme/navigation';
import { useAppTheme } from '@/theme/theme';

export default function BuilderLayout() {
  const theme = useAppTheme();
  return (
    <Stack
      screenOptions={{
        ...headerOptions(theme),
        headerTitle: 'New app',
        headerRight: () => (
          <IconButton
            icon="close"
            accessibilityLabel="Close builder. Your draft is saved."
            onPress={() => (router.canGoBack() ? router.dismissAll() : router.replace('/'))}
          />
        ),
      }}
    />
  );
}
