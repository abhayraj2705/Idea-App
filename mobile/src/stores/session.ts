import { create } from 'zustand';

import { authApi } from '@/api/endpoints/auth';
import { notificationsApi } from '@/api/endpoints/platform';
import type { AppConfig, AuthSession, User } from '@/api/types';
import { queryClient } from '@/lib/queryClient';
import { secureStore } from '@/lib/secureStore';
import { setSentryUser } from '@/lib/sentry';
import { storage } from '@/lib/storage';

/** 'guest' = one anonymous generation before sign-up (decision D2). */
export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';
export type SignOutReason = 'user' | 'expired' | 'deleted';

type SessionState = {
  status: SessionStatus;
  user: User | null;
  appConfig: AppConfig | null;
  signOutReason: SignOutReason | null;
  /** Holds the short-lived 2FA token between login and /2fa/verify. Memory only. */
  pendingTwoFactor: string | null;
  /** Team invite token from a deep link opened while signed out. Memory only, used once. */
  pendingInvite: string | null;
  setPendingInvite: (t: string | null) => void;
  enterGuest: () => void;
  exitGuest: () => void;
  setAppConfig: (c: AppConfig | null) => void;
  setUser: (u: User) => void;
  restore: () => Promise<void>;
  signIn: (s: AuthSession) => Promise<void>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  setPendingTwoFactor: (t: string | null) => void;
};

let signingOut = false;

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  user: null,
  appConfig: null,
  signOutReason: null,
  pendingTwoFactor: null,
  pendingInvite: null,

  setPendingInvite: (pendingInvite) => set({ pendingInvite }),
  enterGuest: () => set({ status: 'guest', signOutReason: null }),
  /** Leave guest mode for sign-up; the guestToken is kept so the backend can claim guest projects. */
  exitGuest: () => set({ status: 'signedOut', signOutReason: null }),
  setAppConfig: (appConfig) => set({ appConfig }),
  setUser: (user) => {
    set({ user });
    queryClient.setQueryData(['me'], user);
  },
  setPendingTwoFactor: (pendingTwoFactor) => set({ pendingTwoFactor }),

  /** Launch: read token → /me → signed in or out (§8.4). */
  restore: async () => {
    const token = await secureStore.getToken();
    if (!token) {
      set({ status: 'signedOut' });
      return;
    }
    // Use cached user for an instant offline open, then validate.
    const cached = queryClient.getQueryData<User>(['me']);
    if (cached) set({ user: cached, status: 'signedIn' });
    try {
      const user = await authApi.me();
      queryClient.setQueryData(['me'], user);
      setSentryUser(user.id);
      set({ user, status: 'signedIn' });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 401) {
        await get().signOut('expired');
      } else if (!cached) {
        // Offline with a token but no cache: let them in; queries will retry.
        set({ status: 'signedIn' });
      }
    }
  },

  signIn: async ({ token, user }) => {
    await secureStore.setToken(token);
    queryClient.setQueryData(['me'], user);
    setSentryUser(user.id);
    set({ user, status: 'signedIn', signOutReason: null, pendingTwoFactor: null });
  },

  /** Sign-out: DELETE device token → clear SecureStore, query cache, MMKV user data. The builder draft survives an expiry. */
  signOut: async (reason = 'user') => {
    if (signingOut) return;
    signingOut = true;
    try {
      const push = await secureStore.getPushToken();
      if (push && reason !== 'expired' && reason !== 'deleted') {
        await notificationsApi.unregisterDevice(push).catch(() => {});
      }
      await secureStore.clearToken();
      await secureStore.clearPushToken();
      if (reason !== 'expired') {
        await secureStore.clearGuestToken();
        storage.clearUserData();
      }
      queryClient.clear();
      setSentryUser(null);
      set({ user: null, status: 'signedOut', signOutReason: reason, pendingTwoFactor: null });
    } finally {
      signingOut = false;
    }
  },
}));

export const useFeatures = () => {
  const flags = useSession((s) => s.appConfig?.features);
  return {
    editChat: flags?.editChat ?? true,
    mobileBuild: flags?.mobileBuild ?? false,
    planApprovalGate: flags?.planApprovalGate ?? false,
    generationScope: flags?.generationScope ?? true,
    wireframeGate: flags?.wireframeGate ?? true,
    frontendPreview: flags?.frontendPreview ?? true,
    conversationThread: flags?.conversationThread ?? true,
    elasticGenerationBudget: flags?.elasticGenerationBudget ?? true,
  };
};
