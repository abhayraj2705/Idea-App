import { create } from 'zustand';

import { StorageKeys, storage } from '@/lib/storage';

export type ThemeMode = 'system' | 'light' | 'dark';

type Prefs = {
  themeMode: ThemeMode;
  appLock: boolean;
  showExperimentalStacks: boolean;
};

type PrefsState = Prefs & {
  set: (patch: Partial<Prefs>) => void;
};

const defaults: Prefs = { themeMode: 'system', appLock: false, showExperimentalStacks: false };

export const usePrefs = create<PrefsState>((set, get) => ({
  ...defaults,
  ...storage.getJSON<Partial<Prefs>>(StorageKeys.prefs),
  set: (patch) => {
    set(patch);
    const { themeMode, appLock, showExperimentalStacks } = { ...get(), ...patch };
    storage.setJSON(StorageKeys.prefs, { themeMode, appLock, showExperimentalStacks });
  },
}));
