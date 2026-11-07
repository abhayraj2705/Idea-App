import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Non-secret, synchronous storage (MMKV): prefs, builder drafts and the
 * persisted query cache. Credentials NEVER go here — see secureStore.ts.
 */
let instance: MMKV | null = null;
const memory = new Map<string, string>();

function mmkv(): MMKV | null {
  if (instance) return instance;
  try {
    instance = createMMKV({ id: 'idea-app' });
  } catch {
    instance = null; // e.g. Jest or an unsupported runtime → in-memory fallback
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
