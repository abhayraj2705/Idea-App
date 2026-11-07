import { api } from '../client';
import type { AuthSession, LoginResult, Quota, User } from '../types';

const B = '/api/platform/auth';

export const authApi = {
  register: (body: { email: string; password: string; name?: string }) =>
    api.post<AuthSession>(`${B}/register`, body, { auth: false }),
  login: (body: { email: string; password: string }) => api.post<LoginResult>(`${B}/login`, body, { auth: false }),
  verify2fa: (body: { tempToken: string; code: string }) =>
    api.post<AuthSession>(`${B}/2fa/verify`, body, { auth: false }),
  google: (idToken: string) => api.post<AuthSession>(`${B}/google`, { idToken }, { auth: false }),
  /** §6.3 */
  apple: (body: { identityToken: string; nonce: string; fullName?: string }) =>
    api.post<AuthSession>(`${B}/apple`, body, { auth: false }),
  /** §6.2 — one-time code from the native OAuth redirect. */
  oauthExchange: (code: string) => api.post<AuthSession>(`${B}/oauth/exchange`, { code }, { auth: false }),
  forgotPassword: (email: string) => api.post<{ sent: boolean }>(`${B}/forgot-password`, { email }, { auth: false }),
  resetPassword: (token: string, password: string) =>
    api.post<{ reset: boolean }>(`${B}/reset-password`, { token, password }, { auth: false }),
  verifyEmail: (token: string) => api.post<{ verified: boolean }>(`${B}/verify-email`, { token }, { auth: false }),
  resendVerification: () => api.post<{ sent: boolean }>(`${B}/resend-verification`),
  me: () => api.get<User>(`${B}/me`),
  updateProfile: (body: Partial<Pick<User, 'name' | 'avatarUrl' | 'defaultStack'>>) => api.patch<User>(`${B}/profile`, body),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<{ changed: boolean }>(`${B}/change-password`, body),
  completeOnboarding: (body: { defaultStack?: string }) => api.post<User>(`${B}/onboarding/complete`, body),
  setup2fa: () => api.post<{ secret: string; otpauthUrl: string }>(`${B}/2fa/setup`),
  enable2fa: (code: string) => api.post<{ enabled: boolean; recoveryCodes?: string[] }>(`${B}/2fa/enable`, { code }),
  disable2fa: (body: { code?: string; password?: string }) => api.post<{ enabled: boolean }>(`${B}/2fa/disable`, body),
  saveApiKey: (provider: string, key: string) => api.post<{ saved: boolean }>(`${B}/api-keys`, { provider, key }),
  deleteApiKey: (provider: string) => api.del<{ deleted: boolean }>(`${B}/api-keys/${encodeURIComponent(provider)}`),
  quota: () => api.get<Quota>(`${B}/quota`),
  /** §6.4 — account deletion with re-confirmation. */
  deleteAccount: (body: { password?: string; code?: string }) => api.del<{ deleted: boolean }>(`${B}/me`, body),
  /** GitHub start URL for the native OAuth flow (§6.2). */
  githubStartPath: (redirect: string) => `${B}/github/start?client=mobile&redirect=${encodeURIComponent(redirect)}`,
};
