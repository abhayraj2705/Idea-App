import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Credentials live only in Keychain / Keystore (§10).
 * Web (dev preview only) falls back to sessionStorage so nothing persists.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const KEYS = {
  token: 'idea.jwt',
  guestToken: 'idea.guestToken',
  pushToken: 'idea.expoPushToken',
} as const;

type Key = keyof typeof KEYS;

const isWeb = Platform.OS === 'web';

async function get(key: Key): Promise<string | null> {
  if (isWeb) return globalThis.sessionStorage?.getItem(KEYS[key]) ?? null;
  try {
    return await SecureStore.getItemAsync(KEYS[key], OPTIONS);
  } catch {
    return null;
  }
}

async function set(key: Key, value: string): Promise<void> {
  if (isWeb) {
    globalThis.sessionStorage?.setItem(KEYS[key], value);
    return;
  }
  await SecureStore.setItemAsync(KEYS[key], value, OPTIONS);
}

async function remove(key: Key): Promise<void> {
  if (isWeb) {
    globalThis.sessionStorage?.removeItem(KEYS[key]);
    return;
  }
  await SecureStore.deleteItemAsync(KEYS[key], OPTIONS);
}

export const secureStore = {
  getToken: () => get('token'),
  setToken: (v: string) => set('token', v),
  clearToken: () => remove('token'),
  getGuestToken: () => get('guestToken'),
  setGuestToken: (v: string) => set('guestToken', v),
  clearGuestToken: () => remove('guestToken'),
  getPushToken: () => get('pushToken'),
  setPushToken: (v: string) => set('pushToken', v),
  clearPushToken: () => remove('pushToken'),
};
