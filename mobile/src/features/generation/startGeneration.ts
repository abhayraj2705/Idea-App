import { ApiError } from '@/api/client';
import { aiApi } from '@/api/endpoints/ai';
import { sseRequest, type SseRequest } from '@/api/sse';
import type { RequirementsDocument } from '@/api/types';

/**
 * Starts a generation (POST /api/ai/generate/v2) and resolves with its job id.
 *
 * The backend answers in one of two ways:
 *  - **Queued** (Redis configured): `202 { jobId, guestToken }` as JSON. The run
 *    lives on a worker; the job screen follows `/jobs/:id/stream`.
 *  - **Inline** (no Redis, e.g. local dev): the run happens *inside this request*
 *    and streams SSE; an early frame is `{ type: 'job', jobId }`. Closing the
 *    connection cancels the run server-side, so the request is kept open in the
 *    background (see `live`) for as long as the app process lives, while the job
 *    screen follows the same run through `/jobs/:id/stream` like a queued one.
 */
export type GenerateBody = {
  userPrompt: string;
  projectName?: string;
  stackId?: string;
  provider?: string;
  model?: string;
  requirements?: RequirementsDocument;
  designImage?: string;
  selectedModules?: string[];
};

export type GenerationStarted = { jobId: string; guestToken?: string; mode: 'queued' | 'inline' };

/** Inline runs whose request must stay open. Keyed by job id. */
const live = new Map<string, SseRequest>();

const JOB_EVENT_TIMEOUT_MS = 90_000;

export function isInlineRunAttached(jobId: string) {
  return live.has(jobId);
}

/** Drops the inline connection; the server treats that as a cancel. */
export function detachInlineRun(jobId: string) {
  live.get(jobId)?.abort();
  live.delete(jobId);
}

export function startGeneration(body: GenerateBody, idempotencyKey: string): Promise<GenerationStarted> {
  return new Promise<GenerationStarted>((resolve, reject) => {
    let settled = false;
    let jobId: string | null = null;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const req = sseRequest(aiApi.generatePath, {
      body: { selectedModules: [], ...body },
      headers: { 'Idempotency-Key': idempotencyKey },
      onJson: (json) => {
        const data = (json.data ?? json) as Record<string, unknown>;
        if (typeof data.jobId === 'string') {
          const guestToken = typeof data.guestToken === 'string' ? data.guestToken : undefined;
          settle(() => resolve({ jobId: data.jobId as string, guestToken, mode: 'queued' }));
        } else {
          settle(() => reject(new ApiError(500, String(json.error ?? 'Generation could not be queued.'))));
        }
      },
      onEvent: ({ type, data }) => {
        if (type === 'job' && typeof data.jobId === 'string' && !jobId) {
          jobId = data.jobId;
          live.set(jobId, req);
          const guestToken = typeof data.guestToken === 'string' ? data.guestToken : undefined;
          settle(() => resolve({ jobId: jobId!, guestToken, mode: 'inline' }));
        } else if (type === 'error' && !settled) {
          req.abort();
          settle(() => reject(new ApiError(500, String(data.message ?? data.error ?? 'Generation failed to start.'))));
        }
      },
    });

    const timer = setTimeout(() => {
      req.abort();
      settle(() => reject(new ApiError(0, 'The server took too long to start the generation. Please try again.')));
    }, JOB_EVENT_TIMEOUT_MS);

    req.done
      .then(() => settle(() => reject(new ApiError(0, 'The generation ended before it started.'))))
      .catch((e: unknown) => settle(() => reject(e)))
      .finally(() => {
        if (jobId) live.delete(jobId);
      });
  });
}
