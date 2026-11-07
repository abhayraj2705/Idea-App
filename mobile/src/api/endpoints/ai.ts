import { api } from '../client';
import type {
  Capabilities,
  ChatMode,
  EditProposal,
  Estimate,
  GenerateAccepted,
  GenerateRequest,
  Job,
  JobEvent,
  Provider,
  Requirement,
  UsageStats,
  Wireframe,
} from '../types';

const B = '/api/ai';
const J = '/api/ai/jobs';

export const aiApi = {
  providers: () => api.get<Provider[]>(`${B}/providers`),
  capabilities: () => api.get<Capabilities>(`${B}/capabilities`),
  estimate: (body: Partial<GenerateRequest>) => api.post<Estimate>(`${B}/estimate`, body),
  requirements: (body: { prompt: string; stack?: string; scope?: string }) =>
    api.post<{ requirements: Requirement[]; projectName?: string }>(`${B}/requirements`, body, { guest: true }),
  suggestRequirements: (body: { prompt: string; requirements: Requirement[] }) =>
    api.post<{ requirements: Requirement[] }>(`${B}/requirements/suggest`, body, { guest: true }),
  compileRequirements: (body: { prompt: string; requirements: Requirement[] }) =>
    api.post<{ compiled: string }>(`${B}/requirements/compile`, body, { guest: true }),
  wireframe: (body: { prompt: string; requirements: Requirement[]; stack?: string }) =>
    api.post<Wireframe>(`${B}/wireframe`, body, { guest: true, timeoutMs: 90_000 }),
  generate: (body: GenerateRequest, idempotencyKey: string) =>
    api.post<GenerateAccepted>(`${B}/generate/v2`, body, { guest: true, idempotencyKey, timeoutMs: 60_000 }),
  chatV2: (body: { projectId: string; conversationId?: string; mode: ChatMode; message: string }) =>
    api.post<{ jobId?: string; turnId?: string; streamUrl?: string; reply?: string; proposalId?: string }>(
      `${B}/chat/v2`,
      body,
      { guest: true, timeoutMs: 60_000 },
    ),
  chatLegacy: (body: { projectId: string; message: string; mode: 'chat' | 'refine' }) =>
    api.post<{ reply: string; jobId?: string }>(body.mode === 'refine' ? `${B}/refine` : `${B}/chat`, body, {
      guest: true,
      timeoutMs: 120_000,
    }),
  proposal: (proposalId: string) => api.get<EditProposal>(`${B}/edits/${proposalId}`, { guest: true }),
  applyProposal: (proposalId: string) =>
    api.post<{ applied: boolean; checkpointId?: string }>(`${B}/edits/${proposalId}/apply`, {}, { guest: true }),
  discardProposal: (proposalId: string) =>
    api.post<{ discarded: boolean }>(`${B}/edits/${proposalId}/discard`, {}, { guest: true }),
  explain: (body: { projectId: string; path: string }) =>
    api.post<{ explanation: string }>(`${B}/explain`, body, { guest: true, timeoutMs: 90_000 }),
  designToCode: (body: { image: string; prompt?: string }) =>
    api.post<{ prompt: string; requirements?: Requirement[] }>(`${B}/design-to-code`, body, { timeoutMs: 120_000 }),
  usageStats: () => api.get<UsageStats>(`${B}/usage-stats`),

  // Jobs
  jobs: () => api.get<Job[]>(J),
  job: (jobId: string) => api.get<Job>(`${J}/${jobId}`, { guest: true }),
  events: (jobId: string, fromSeq: number) =>
    api.get<JobEvent[]>(`${J}/${jobId}/events`, { guest: true, query: { fromSeq } }),
  streamPath: (jobId: string, fromSeq: number) => `${J}/${jobId}/stream?fromSeq=${fromSeq}`,
  cancel: (jobId: string) => api.post<Job>(`${J}/${jobId}/cancel`, {}, { guest: true }),
  retry: (jobId: string) => api.post<{ jobId: string }>(`${J}/${jobId}/retry`, {}, { guest: true }),
  finalize: (jobId: string) => api.post<Job>(`${J}/${jobId}/finalize`, {}, { guest: true }),
  approvePlan: (jobId: string) => api.post<Job>(`${J}/${jobId}/approve-plan`, {}, { guest: true }),
  adjustPlan: (jobId: string, feedback: string) =>
    api.post<Job>(`${J}/${jobId}/adjust-plan`, { feedback }, { guest: true }),
  repair: (jobId: string) => api.post<{ jobId: string }>(`${J}/${jobId}/repair`, {}, { guest: true }),
};
