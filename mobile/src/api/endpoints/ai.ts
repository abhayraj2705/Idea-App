import { itemOf, listOf, toCapabilities, toEstimate, toJob, toJobEvents, toProviders, toWireframe } from '../adapters';
import { api } from '../client';
import type {
  Capabilities,
  ChatMode,
  EditProposal,
  Estimate,
  FeatureFlags,
  Job,
  Provider,
  QuestionsResult,
  Requirement,
  RequirementsAnswer,
  RequirementsDocument,
  RequirementsQuestion,
  UsageStats,
  Wireframe,
} from '../types';

/** Which model runs a step. The backend defaults to Gemini when omitted. */
type AiModel = { provider?: string; model?: string };

const B = '/api/ai';
const J = '/api/ai/jobs';

export const aiApi = {
  providers: (): Promise<Provider[]> => api.get<unknown>(`${B}/providers`).then(toProviders),
  /** Stacks plus the server's feature flags (used when /app-config isn't deployed). */
  capabilities: (): Promise<Capabilities & { flags: Partial<FeatureFlags> }> => api.get<unknown>(`${B}/capabilities`).then(toCapabilities),
  estimate: (body: { userPrompt: string; requirements?: RequirementsDocument; provider?: string; model?: string }): Promise<Estimate> =>
    api.post<unknown>(`${B}/estimate`, body).then(toEstimate),

  // Requirements interview: idea → clarifying questions → answers → compiled document.
  questions: (body: { userIdea: string } & AiModel): Promise<QuestionsResult> =>
    api
      .post<unknown>(`${B}/requirements`, { ...body, selectedModules: [] }, { guest: true, timeoutMs: 120_000 })
      .then((d) => {
        const r = itemOf<Record<string, unknown>>(d, 'result');
        return { ...(r as QuestionsResult), questions: listOf<RequirementsQuestion>(r, 'questions') };
      }),
  /** "Decide for me": suggested answers for the unanswered questions. */
  suggestAnswers: (
    body: { userIdea: string; projectName?: string; questions: RequirementsQuestion[]; answers: RequirementsAnswer[]; questionIds?: string[] } & AiModel,
  ) =>
    api
      .post<unknown>(`${B}/requirements/suggest`, { ...body, selectedModules: [] }, { guest: true, timeoutMs: 120_000 })
      .then((d) => listOf<{ questionId: string; suggestedAnswer: string }>(d, 'suggestions')),
  compile: (body: { originalPrompt: string; projectName: string; answers: RequirementsAnswer[] } & AiModel) =>
    api
      .post<unknown>(`${B}/requirements/compile`, { ...body, selectedModules: [] }, { guest: true, timeoutMs: 120_000 })
      .then((d) => itemOf<RequirementsDocument>(d, 'requirements')),
  wireframe: (body: { userPrompt: string; requirements: RequirementsDocument; adjustmentNote?: string } & AiModel): Promise<Wireframe> =>
    api.post<unknown>(`${B}/wireframe`, body, { guest: true, timeoutMs: 120_000 }).then(toWireframe),
  /** Started through features/generation/startGeneration (it may stream the whole run). */
  generatePath: `${B}/generate/v2`,
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
  jobs: () => api.get<unknown>(J).then((d) => listOf<unknown>(d, 'jobs').map(toJob)),
  job: (jobId: string): Promise<Job> => api.get<unknown>(`${J}/${jobId}`, { guest: true }).then(toJob),
  /** The server returns the whole transcript; only events after `fromSeq` are kept. */
  events: (jobId: string, fromSeq: number) =>
    api
      .get<unknown>(`${J}/${jobId}/events`, { guest: true, query: { fromSeq } })
      .then((d) => toJobEvents(d).filter((e) => e.seq >= fromSeq)),
  streamPath: (jobId: string, fromSeq: number) => `${J}/${jobId}/stream?fromSeq=${fromSeq}`,
  cancel: (jobId: string) => api.post<Job>(`${J}/${jobId}/cancel`, {}, { guest: true }),
  retry: (jobId: string) => api.post<{ jobId: string }>(`${J}/${jobId}/retry`, {}, { guest: true }),
  finalize: (jobId: string) => api.post<Job>(`${J}/${jobId}/finalize`, {}, { guest: true }),
  approvePlan: (jobId: string) => api.post<Job>(`${J}/${jobId}/approve-plan`, {}, { guest: true }),
  adjustPlan: (jobId: string, feedback: string) =>
    api.post<Job>(`${J}/${jobId}/adjust-plan`, { feedback }, { guest: true }),
  repair: (jobId: string) => api.post<{ jobId: string }>(`${J}/${jobId}/repair`, {}, { guest: true }),
};
