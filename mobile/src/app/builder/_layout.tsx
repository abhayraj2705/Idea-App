import { router, Stack } from 'expo-router';
import { IconButton } from 'react-native-paper';

export default function BuilderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTitle: 'New idea',
        headerBackButtonDisplayMode: 'minimal',
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
