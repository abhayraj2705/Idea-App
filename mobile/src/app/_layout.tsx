import '@/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { aiApi } from '@/api/endpoints/ai';
import { appConfigApi } from '@/api/endpoints/platform';
import type { AppConfig } from '@/api/types';
import { setUnauthorizedHandler } from '@/api/client';
import { AppLock } from '@/components/AppLock';
import { BootScreen } from '@/components/brand/LogoLoader';
import { installNotificationHandler, useNotificationRouting } from '@/features/notifications/push';
import { config } from '@/lib/config';
import { CACHE_SCHEMA_VERSION, queryClient, queryPersister, shouldPersistQuery } from '@/lib/queryClient';
import { initSentry } from '@/lib/sentry';
import { isBelowMinimum } from '@/lib/version';
import { usePrefs } from '@/stores/prefs';
import { useSession } from '@/stores/session';
import { font, fontAssets } from '@/theme/fonts';
import { headerOptions } from '@/theme/navigation';
import { darkTheme, lightTheme, useAppTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 250, fade: true });
initSentry();
installNotificationHandler();
setUnauthorizedHandler(() => void useSession.getState().signOut('expired'));

export { ErrorBoundary } from 'expo-router';

// Deep links (push notifications, email links) land on nested screens with no
// history; without an initial route, Android back exits the app. `index`
// redirects to the right home for the session when it becomes focused.
export const unstable_settings = { anchor: 'index' };

function useResolvedTheme() {
  const system = useColorScheme();
  const mode = usePrefs((s) => s.themeMode);
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export default function RootLayout() {
  const theme = useResolvedTheme();
  // Brand fonts are bundled, so this resolves in a frame or two. The native splash
  // stays up until then; on a load error we fall back to the system font rather than block.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const navTheme = useMemo(() => {
    const base = theme.dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.background,
        text: theme.colors.onSurface,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
      // Native-stack headers and tab labels use these; keep them on the brand family.
      fonts: {
        regular: { fontFamily: font.regular, fontWeight: '400' as const },
        medium: { fontFamily: font.medium, fontWeight: '400' as const },
        bold: { fontFamily: font.bold, fontWeight: '400' as const },
        heavy: { fontFamily: font.extrabold, fontWeight: '400' as const },
      },
    };
  }, [theme]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => {});
  }, [theme]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            buster: `${config.appVersion}:${CACHE_SCHEMA_VERSION}`,
            dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
          }}
        >
          <PaperProvider theme={theme}>
            <ThemeProvider value={navTheme}>
              <StatusBar style={theme.dark ? 'light' : 'dark'} />
              <AppLock>
                <RootNavigator />
              </AppLock>
            </ThemeProvider>
          </PaperProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const appConfig = useSession((s) => s.appConfig);
  const pendingInvite = useSession((s) => s.pendingInvite);
  const [booted, setBooted] = useState(false);
  const segments = useSegments();
  const theme = useAppTheme();

  // Launch → app-config (update gate) → /me → tabs or auth (§8.4).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await appConfigApi.get();
        if (!cancelled) useSession.getState().setAppConfig(cfg);
      } catch {
        // Backend without /app-config (or offline): take the feature flags the
        // server already reports on /ai/capabilities, so the app never offers a
        // step (scope picker, preview, plan gate) the server has switched off.
        try {
          const caps = await aiApi.capabilities();
          if (!cancelled) {
            useSession.getState().setAppConfig({
              minSupportedVersion: { ios: '0.0.0', android: '0.0.0' },
              maintenance: { active: false },
              features: caps.flags as AppConfig['features'],
            });
          }
        } catch {
          // Offline: continue with defaults; the gate re-checks on next launch.
        }
      }
      await useSession.getState().restore();
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hand off from the static native splash to the animated BootScreen as soon as
  // JS has mounted, instead of holding a frozen splash through the network boot.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  useNotificationRouting(status === 'signedIn');

  // A team invite opened while signed out resumes after sign-in.
  useEffect(() => {
    if (status === 'signedIn' && pendingInvite && segments[0] !== 'team') {
      router.push({ pathname: '/team/accept', params: { token: pendingInvite } });
    }
  }, [status, pendingInvite, segments]);

  if (!booted) return <BootScreen />;

  const minVersion = appConfig?.minSupportedVersion?.[config.platform === 'ios' ? 'ios' : 'android'];
  const needsUpdate = config.platform !== 'web' && isBelowMinimum(config.appVersion, minVersion);
  const maintenance = !!appConfig?.maintenance?.active;
  const gated = needsUpdate || maintenance;

  const signedIn = status === 'signedIn';
  const guest = status === 'guest';
  const needsOnboarding = signedIn && !!user && user.onboardingCompleted === false;

  return (
    <Stack screenOptions={headerOptions(theme)}>
      <Stack.Protected guard={needsUpdate}>
        <Stack.Screen name="update-required" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!needsUpdate && maintenance}>
        <Stack.Screen name="maintenance" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!gated}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {/* Always reachable: email links work signed in or out. */}
        <Stack.Screen name="verify-email" options={{ title: 'Verify email' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset password' }} />
        <Stack.Screen name="oauth" options={{ headerShown: false }} />
        <Stack.Screen name="team/accept" options={{ title: 'Team invite' }} />

        <Stack.Protected guard={!signedIn && !guest}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={needsOnboarding}>
          <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !needsOnboarding}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="templates/index" options={{ title: 'Templates' }} />
          <Stack.Screen name="templates/[id]" options={{ title: 'Template' }} />
          <Stack.Screen name="team/index" options={{ title: 'Team' }} />
          <Stack.Screen name="team/invite" options={{ title: 'Invite', presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={(signedIn && !needsOnboarding) || guest}>
          <Stack.Screen name="builder" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="job/[jobId]/index" options={{ title: 'Generating' }} />
          <Stack.Screen name="job/[jobId]/plan" options={{ title: 'Review plan', presentation: 'modal' }} />
          <Stack.Screen name="project/[id]" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
    </Stack>
  );
}
