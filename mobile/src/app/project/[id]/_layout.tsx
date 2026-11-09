import { Stack } from 'expo-router';

// A deep link straight to chat/files/deploy keeps the project overview underneath for back.
export const unstable_settings = { initialRouteName: 'index' };

export default function ProjectLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ title: 'Project' }} />
      <Stack.Screen name="chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="proposal/[pid]" options={{ title: 'Review changes', presentation: 'modal' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="file" options={{ title: 'File' }} />
      <Stack.Screen name="preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="deploy" options={{ title: 'Deploy' }} />
      <Stack.Screen name="android-build" options={{ title: 'Android build' }} />
      <Stack.Screen name="history" options={{ title: 'Restore points' }} />
    </Stack>
  );
}
