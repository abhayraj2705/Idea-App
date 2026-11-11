import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';

import {
  aiApi,
  appConfigApi,
  authApi,
  connectionsApi,
  dbApi,
  deployApi,
  mobileBuildApi,
  notificationsApi,
  projectsApi,
  teamsApi,
  type ProjectFilter,
} from '@/api';
import { useSession } from '@/stores/session';

/** Query keys (§8.2). */
export const qk = {
  me: ['me'] as const,
  quota: ['quota'] as const,
  appConfig: ['app-config'] as const,
  projects: (filter: ProjectFilter) => ['projects', filter] as const,
  project: (id: string) => ['project', id] as const,
  conversation: (projectId: string) => ['conversation', projectId] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  checkpoints: (projectId: string) => ['checkpoints', projectId] as const,
  jobs: ['jobs'] as const,
  job: (jobId: string) => ['job', jobId] as const,
  deployments: (projectId: string) => ['deployments', projectId] as const,
  builds: (projectId: string) => ['builds', projectId] as const,
  templates: ['templates'] as const,
  team: ['team'] as const,
  capabilities: ['capabilities'] as const,
  providers: ['providers'] as const,
  proposal: (id: string) => ['proposal', id] as const,
  connections: ['connections'] as const,
  connectionCaps: ['connection-capabilities'] as const,
  deployProviders: ['deploy-providers'] as const,
  readiness: (projectId: string) => ['readiness', projectId] as const,
  projectSdk: (projectId: string) => ['project-sdk', projectId] as const,
  dbs: ['dbs'] as const,
  notificationPrefs: ['notification-prefs'] as const,
  usage: ['usage'] as const,
};

const useSignedIn = () => useSession((s) => s.status === 'signedIn');

export const useQuota = () => useQuery({ queryKey: qk.quota, queryFn: authApi.quota, enabled: useSignedIn() });

export const useProjects = (filter: ProjectFilter = 'mine') => {
  const me = useSession((s) => s.user?.id);
  return useQuery({ queryKey: qk.projects(filter), queryFn: () => projectsApi.list(filter, me), enabled: useSignedIn() });
};

export const useProject = (id?: string) =>
  useQuery({ queryKey: qk.project(id ?? ''), queryFn: () => projectsApi.get(id!), enabled: !!id });

export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: projectsApi.templates, staleTime: 10 * 60_000 });

/** Jobs list; refetches every 5 s while focused and something is running. */
export const useJobs = () => {
  const focused = useIsFocused();
  return useQuery({
    queryKey: qk.jobs,
    queryFn: aiApi.jobs,
    enabled: useSignedIn(),
    refetchInterval: (q) =>
      focused && q.state.data?.some((j) => j.status === 'running' || j.status === 'queued') ? 5000 : false,
  });
};

export const useJob = (jobId?: string) =>
  useQuery({ queryKey: qk.job(jobId ?? ''), queryFn: () => aiApi.job(jobId!), enabled: !!jobId });

export const useCapabilities = () =>
  useQuery({ queryKey: qk.capabilities, queryFn: aiApi.capabilities, staleTime: 30 * 60_000 });

export const useProviders = () => useQuery({ queryKey: qk.providers, queryFn: aiApi.providers, staleTime: 30 * 60_000 });

export const useCheckpoints = (projectId?: string) =>
  useQuery({ queryKey: qk.checkpoints(projectId ?? ''), queryFn: () => projectsApi.checkpoints(projectId!), enabled: !!projectId });

export const useProposal = (id?: string) =>
  useQuery({ queryKey: qk.proposal(id ?? ''), queryFn: () => aiApi.proposal(id!), enabled: !!id });

export const useTeam = () => useQuery({ queryKey: qk.team, queryFn: teamsApi.myTeam, enabled: useSignedIn() });

export const useConnections = () => useQuery({ queryKey: qk.connections, queryFn: connectionsApi.list });
export const useConnectionCapabilities = () =>
  useQuery({ queryKey: qk.connectionCaps, queryFn: connectionsApi.capabilities, staleTime: 30 * 60_000 });

export const useDeployProviders = () => useQuery({ queryKey: qk.deployProviders, queryFn: deployApi.providers });

/** Status timelines poll every 5 s while the screen is visible (§7.7). */
export const useDeployments = (projectId?: string) => {
  const focused = useIsFocused();
  return useQuery({
    queryKey: qk.deployments(projectId ?? ''),
    queryFn: () => deployApi.deployments(projectId!),
    enabled: !!projectId,
    refetchInterval: (q) => (focused && q.state.data?.some((d) => d.status === 'running' || d.status === 'pending') ? 5000 : false),
  });
};

export const useBuilds = (projectId?: string) => {
  const focused = useIsFocused();
  return useQuery({
    queryKey: qk.builds(projectId ?? ''),
    queryFn: () => mobileBuildApi.builds(projectId!),
    enabled: !!projectId,
    refetchInterval: (q) =>
      focused && q.state.data?.some((b) => b.status === 'queued' || b.status === 'building') ? 5000 : false,
  });
};

export const useReadiness = (projectId?: string) =>
  useQuery({ queryKey: qk.readiness(projectId ?? ''), queryFn: () => mobileBuildApi.readiness(projectId!), enabled: !!projectId });

export const useProjectSdk = (projectId?: string, enabled = true) =>
  useQuery({
    queryKey: qk.projectSdk(projectId ?? ''),
    queryFn: () => mobileBuildApi.projectSdk(projectId!),
    enabled: !!projectId && enabled,
  });

export const useDbConnections = () => useQuery({ queryKey: qk.dbs, queryFn: dbApi.list });
export const useNotificationPrefs = () => useQuery({ queryKey: qk.notificationPrefs, queryFn: notificationsApi.preferences });
export const useUsage = () => useQuery({ queryKey: qk.usage, queryFn: aiApi.usageStats });

export const useAppConfigQuery = () =>
  useQuery({ queryKey: qk.appConfig, queryFn: appConfigApi.get, staleTime: 5 * 60_000, retry: 1 });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: (readonly unknown[])[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));
}
