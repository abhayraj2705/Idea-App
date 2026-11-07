import { api } from '../client';
import type {
  AppConfig,
  Connection,
  ConnectionCapability,
  DbConnection,
  DeployPlan,
  DeployProvider,
  Deployment,
  MobileBuild,
  MobilePreview,
  NotificationPreferences,
  Readiness,
  SdkInfo,
  Team,
  TeamRole,
} from '../types';

export const appConfigApi = {
  /** §6.6 — public, server-driven flags + update gate. */
  get: () => api.get<AppConfig>('/api/platform/app-config', { auth: false, timeoutMs: 10_000 }),
  health: () => api.get<{ ok: boolean }>('/api/health', { auth: false, timeoutMs: 10_000 }),
};

export const previewApi = {
  sessionToken: (projectId: string) =>
    api.post<{ token: string; url: string }>(`/api/ai/preview/${projectId}/__control/session-token`, {}, { guest: true }),
  createMobilePreview: (projectId: string) => api.post<MobilePreview>(`/api/mobile/projects/${projectId}/preview`),
  mobilePreview: (previewId: string) => api.get<MobilePreview>(`/api/mobile/previews/${previewId}`),
};

const M = '/api/mobile';
export const mobileBuildApi = {
  sdk: () => api.get<{ versions: string[]; latest: string }>(`${M}/sdk`),
  readiness: (projectId: string) => api.get<Readiness>(`${M}/projects/${projectId}/readiness`),
  repair: (projectId: string) => api.post<Readiness>(`${M}/projects/${projectId}/repair`),
  projectSdk: (projectId: string) => api.get<SdkInfo>(`${M}/projects/${projectId}/sdk`),
  upgradeSdk: (projectId: string) => api.post<SdkInfo>(`${M}/projects/${projectId}/upgrade-sdk`),
  builds: (projectId: string) => api.get<MobileBuild[]>(`${M}/projects/${projectId}/builds`),
  startBuild: (projectId: string) => api.post<MobileBuild>(`${M}/projects/${projectId}/builds`, { platform: 'android' }),
  build: (buildId: string) => api.get<MobileBuild>(`${M}/builds/${buildId}`),
};

const D = '/api/deploy';
export const deployApi = {
  providers: () => api.get<DeployProvider[]>(`${D}/providers`),
  previewPlan: (projectId: string, provider: string) => api.post<DeployPlan>(`${D}/plan/preview`, { projectId, provider }),
  launch: (planId: string) => api.post<Deployment>(`${D}/launch`, { planId }),
  plan: (planId: string) => api.get<DeployPlan>(`${D}/plan/${planId}`),
  cancelPlan: (planId: string) => api.post<DeployPlan>(`${D}/plan/${planId}/cancel`),
  deployments: (projectId: string) => api.get<Deployment[]>(`${D}/deployments/${projectId}`),
  status: (deploymentId: string) => api.get<Deployment>(`${D}/deployment/${deploymentId}/status`),
};

const C = '/api/platform/connections';
export const connectionsApi = {
  capabilities: () => api.get<ConnectionCapability[]>(`${C}/capabilities`),
  list: () => api.get<Connection[]>(C),
  /** §6.2 native redirect variant. */
  oauthStart: (provider: string, redirect: string) =>
    api.post<{ url: string }>(`${C}/${provider}/oauth/start`, { client: 'mobile', redirect }),
  exchange: (code: string) => api.post<{ connectionId: string }>(`${C}/oauth/exchange`, { code }),
  savePat: (provider: string, token: string) => api.post<Connection>(`${C}/${provider}/pat`, { token }),
  remove: (id: string) => api.del<{ deleted: boolean }>(`${C}/${id}`),
};

const T = '/api/platform/teams';
export const teamsApi = {
  create: (name: string) => api.post<Team>(T, { name }),
  myTeam: () => api.get<Team | null>(`${T}/my-team`),
  invite: (email: string, role: TeamRole) => api.post<{ token: string }>(`${T}/invite`, { email, role }),
  acceptInvite: (token: string) => api.post<Team>(`${T}/accept-invite`, { token }),
  setRole: (userId: string, role: TeamRole) => api.patch<Team>(`${T}/members/${userId}/role`, { role }),
  removeMember: (userId: string) => api.del<Team>(`${T}/members/${userId}`),
  transferOwnership: (userId: string) => api.post<Team>(`${T}/transfer-ownership`, { userId }),
  revokeInvite: (token: string) => api.del<{ revoked: boolean }>(`${T}/invites/${token}`),
  leave: () => api.post<{ left: boolean }>(`${T}/leave`),
  dissolve: () => api.del<{ deleted: boolean }>(T),
};

export const dbApi = {
  engines: () => api.get<{ id: string; name: string }[]>('/api/db/engines'),
  list: () => api.get<DbConnection[]>('/api/db'),
  test: (id: string) => api.post<{ ok: boolean; message?: string; latencyMs?: number }>(`/api/db/${id}/test`),
};

const N = '/api/platform/notifications';
export const notificationsApi = {
  registerDevice: (body: { expoPushToken: string; platform: string; appVersion: string }) =>
    api.post<{ registered: boolean }>(`${N}/devices`, body),
  unregisterDevice: (token: string) => api.del<{ removed: boolean }>(`${N}/devices/${encodeURIComponent(token)}`),
  preferences: () => api.get<NotificationPreferences>(`${N}/preferences`),
  updatePreferences: (body: Partial<NotificationPreferences>) => api.patch<NotificationPreferences>(`${N}/preferences`, body),
};
