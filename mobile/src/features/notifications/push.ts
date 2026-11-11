import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { notificationsApi } from '@/api/endpoints/platform';
import { track } from '@/lib/analytics';
import { config } from '@/lib/config';
import { secureStore } from '@/lib/secureStore';
import { StorageKeys, storage } from '@/lib/storage';

import { routeForPush, type PushData } from './routes';

/**
 * Push (§6.5). Payloads carry ids only: { type, jobId?, projectId?, buildId?, deploymentId? }.
 * Permission is asked after the first generation starts, never at launch (§13.3).
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/** Called once from the root layout. Foreground notifications show as a banner. */
export function installNotificationHandler() {
  if (!isNative) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('generation', {
    name: 'Generation updates',
    description: 'When your app is ready, needs plan approval, or fails.',
    importance: AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('builds', {
    name: 'Builds & deploys',
    importance: AndroidImportance.DEFAULT,
  });
}

function projectId(): string | undefined {
  const eas = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas;
  return eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Registers the device if permission is (or becomes) granted. Safe to call repeatedly. */
export async function registerForPush(opts: { prompt: boolean }): Promise<'granted' | 'denied' | 'unavailable'> {
  if (!isNative || !Device.isDevice) return 'unavailable';
  await ensureAndroidChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && opts.prompt) {
    storage.set(StorageKeys.notificationsAsked, '1');
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return 'denied';
  const pid = projectId();
  if (!pid) return 'unavailable';
  try {
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId: pid });
    await notificationsApi.registerDevice({ expoPushToken, platform: Platform.OS, appVersion: config.appVersion });
    await secureStore.setPushToken(expoPushToken);
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

/** Ask once, after the user's first generation starts. */
export async function maybeAskAfterFirstGeneration() {
  if (storage.getString(StorageKeys.notificationsAsked)) return;
  await registerForPush({ prompt: true });
}

function handleResponse(response: Notifications.NotificationResponse | null) {
  if (!response) return;
  const data = (response.notification.request.content.data ?? {}) as PushData;
  const route = routeForPush(data);
  track('push_opened', { type: data.type ?? 'unknown' });
  if (route) router.push(route as never);
}

/** Mount once inside the signed-in shell. Handles cold-start taps too. */
export function useNotificationRouting(enabled: boolean) {
  useEffect(() => {
    if (!isNative || !enabled) return;
    handleResponse(Notifications.getLastNotificationResponse());
    void registerForPush({ prompt: false });
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [enabled]);
}
