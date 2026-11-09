import type { MMKV } from 'react-native-mmkv';

/**
 * Non-secret, synchronous storage (MMKV): prefs, builder drafts and the
 * persisted query cache. Credentials NEVER go here — see secureStore.ts.
 *
 * react-native-mmkv v4 is built on Nitro Modules, which are NOT bundled in
 * Expo Go. Importing it there throws at module-evaluation time, so it is
 * required lazily inside the try/catch below; a static import would crash
 * every route that (transitively) imports this file. In Expo Go, Jest or any
 * other runtime without the native module, data lives in memory for the
 * session. Development and production builds use MMKV as normal.
 */
let instance: MMKV | null = null;
let unavailable = false;
const memory = new Map<string, string>();

function mmkv(): MMKV | null {
  if (instance || unavailable) return instance;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    instance = createMMKV({ id: 'idea-app' });
  } catch {
    unavailable = true;
    if (__DEV__ && process.env.NODE_ENV !== 'test') {
      console.warn(
        '[storage] MMKV native module not available (Expo Go?). Using in-memory storage; ' +
          'prefs and drafts will not persist across restarts. Use a development build for full behaviour.',
      );
    }
  }
  return instance;
}

export const storage = {
  getString(key: string): string | undefined {
    const s = mmkv();
    return s ? s.getString(key) : memory.get(key);
  },
  set(key: string, value: string) {
    const s = mmkv();
    if (s) s.set(key, value);
    else memory.set(key, value);
  },
  remove(key: string) {
    const s = mmkv();
    if (s) s.remove(key);
    else memory.delete(key);
  },
  getJSON<T>(key: string): T | undefined {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  },
  setJSON(key: string, value: unknown) {
    storage.set(key, JSON.stringify(value));
  },
  /** Removes user-scoped data on sign-out (§8.4). Prefs survive. */
  clearUserData() {
    for (const key of [StorageKeys.queryCache, StorageKeys.builderDraft, StorageKeys.recentFiles]) {
      storage.remove(key);
    }
  },
};

export const StorageKeys = {
  queryCache: 'rq-cache-v1',
  builderDraft: 'builder-draft-v1',
  prefs: 'prefs-v1',
  recentFiles: 'recent-files-v1',
  notificationsAsked: 'notifications-asked',
  onboardingSeen: 'onboarding-seen',
} as const;
