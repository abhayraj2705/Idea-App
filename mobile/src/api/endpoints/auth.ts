import { toQuota, toSession, toUser } from '../adapters';
import { api } from '../client';
import type { AuthSession, LoginResult, Quota, User } from '../types';

const B = '/api/platform/auth';

export const authApi = {
  register: (body: { email: string; password: string; name?: string }) =>
    api.post<unknown>(`${B}/register`, body, { auth: false }).then((d) => toSession<AuthSession>(d)),
  login: (body: { email: string; password: string }) =>
    api.post<unknown>(`${B}/login`, body, { auth: false }).then((d) => toSession<LoginResult>(d)),
  verify2fa: (body: { tempToken: string; code: string }) =>
    // The backend's field is `preAuthToken` (the token login returned with twoFactorRequired).
    api
      .post<unknown>(`${B}/2fa/verify`, { preAuthToken: body.tempToken, code: body.code }, { auth: false })
      .then((d) => toSession<AuthSession>(d)),
  google: (idToken: string) => api.post<unknown>(`${B}/google`, { idToken }, { auth: false }).then((d) => toSession<AuthSession>(d)),
  /** §6.3 */
  apple: (body: { identityToken: string; nonce: string; fullName?: string }) =>
    api.post<unknown>(`${B}/apple`, body, { auth: false }).then((d) => toSession<AuthSession>(d)),
  /** §6.2 — one-time code from the native OAuth redirect. */
  oauthExchange: (code: string) =>
    api.post<unknown>(`${B}/oauth/exchange`, { code }, { auth: false }).then((d) => toSession<AuthSession>(d)),
  forgotPassword: (email: string) => api.post<{ sent: boolean }>(`${B}/forgot-password`, { email }, { auth: false }),
  resetPassword: (token: string, password: string) =>
    api.post<{ reset: boolean }>(`${B}/reset-password`, { token, password }, { auth: false }),
  verifyEmail: (token: string) => api.post<{ verified: boolean }>(`${B}/verify-email`, { token }, { auth: false }),
  resendVerification: () => api.post<{ sent: boolean }>(`${B}/resend-verification`),
  me: () => api.get<unknown>(`${B}/me`).then(toUser),
  updateProfile: (body: Partial<Pick<User, 'name' | 'avatarUrl' | 'defaultStack'>>) => api.patch<unknown>(`${B}/profile`, body).then(toUser),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<{ changed: boolean }>(`${B}/change-password`, body),
  /** Returns an acknowledgement (`{ hasCompletedOnboarding }`), not the user. */
  completeOnboarding: (body: { defaultStack?: string }) => api.post<unknown>(`${B}/onboarding/complete`, body),
  setup2fa: () => api.post<{ secret: string; otpauthUrl: string }>(`${B}/2fa/setup`),
  enable2fa: (code: string) => api.post<{ enabled: boolean; recoveryCodes?: string[] }>(`${B}/2fa/enable`, { code }),
  disable2fa: (body: { code?: string; password?: string }) => api.post<{ enabled: boolean }>(`${B}/2fa/disable`, body),
  saveApiKey: (provider: string, key: string) => api.post<{ saved: boolean }>(`${B}/api-keys`, { provider, key }),
  deleteApiKey: (provider: string) => api.del<{ deleted: boolean }>(`${B}/api-keys/${encodeURIComponent(provider)}`),
  quota: (): Promise<Quota> => api.get<unknown>(`${B}/quota`).then(toQuota),
  /** §6.4 — account deletion with re-confirmation. */
  deleteAccount: (body: { password?: string; code?: string }) => api.del<{ deleted: boolean }>(`${B}/me`, body),
  /** GitHub start URL for the native OAuth flow (§6.2). */
  githubStartPath: (redirect: string) => `${B}/github/start?client=mobile&redirect=${encodeURIComponent(redirect)}`,
};
