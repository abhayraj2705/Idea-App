import EventSource from 'react-native-sse';

import { aiApi, authHeaders, buildUrl } from '@/api';
import type { JobEvent } from '@/api/types';

import { isKnownEventType } from './eventReducer';

/**
 * Job stream controller (§7.3 lifecycle):
 *  - SSE on /stream?fromSeq=N (replay, then live)
 *  - reconnect with exponential backoff (max 30 s) on error
 *  - after 3 consecutive SSE failures, poll /events?fromSeq= every 3 s
 *  - heartbeat: no event for 60 s → reconnect
 *  - the caller stops the stream when the app backgrounds (never hold a socket)
 */
export const MAX_BACKOFF_MS = 30_000;
export const SSE_FAILURES_BEFORE_POLL = 3;
export const POLL_INTERVAL_MS = 3_000;
export const HEARTBEAT_MS = 60_000;

export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempt), MAX_BACKOFF_MS);
}

export function shouldFallbackToPolling(consecutiveFailures: number): boolean {
  return consecutiveFailures >= SSE_FAILURES_BEFORE_POLL;
}

/** Parse one SSE frame into a JobEvent. Supports named events and `message` frames carrying {type, seq, data}. */
export function parseFrame(eventName: string, raw: string | null, lastEventId: string | null): JobEvent | null {
  if (!raw) return null;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  const type = eventName !== 'message' ? eventName : typeof body.type === 'string' ? body.type : null;
  if (!type) return null;
  const seqFromBody = typeof body.seq === 'number' ? body.seq : undefined;
  const seqFromId = lastEventId != null && lastEventId !== '' ? Number(lastEventId) : undefined;
  const seq = seqFromBody ?? (Number.isFinite(seqFromId) ? (seqFromId as number) : undefined);
  // The server closes a finished stream with `{ type: 'stream_end', status }`, which
  // isn't part of the transcript and so has no seq. It still carries the final status.
  if (seq === undefined) return type === 'stream_end' ? { seq: -1, type, data: body } : null;
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
  return { seq, type, data };
}

export type StreamMode = 'idle' | 'sse' | 'polling' | 'reconnecting';

type Handlers = {
  onEvents: (events: JobEvent[]) => void;
  onModeChange?: (mode: StreamMode) => void;
  isTerminal: () => boolean;
  getLastSeq: () => number;
};

const STREAM_EVENT_NAMES = [
  'phase', 'plan_ready', 'plan_completed', 'module_complete', 'file_checkpoint', 'healing_scan', 'healing_pass',
  'healing_round', 'healing_files', 'healing_convergence', 'typecheck_report', 'compile_report', 'validation_report',
  'verification_report', 'quality_report', 'issue_ledger', 'preview_readiness', 'budget_report', 'completeness_gap',
  'phase_diagnostic', 'token_limit', 'codemod_report', 'repair_report', 'generation_quality_complete', 'complete',
  'file', 'canceled', 'stream_end',
  'error', 'turn', 'delta', 'agent_step', 'proposal', 'scope_upgrade_required',
] as const;

export class JobStream {
  private es: EventSource<string> | null = null;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private mode: StreamMode = 'idle';

  constructor(
    private readonly jobId: string,
    private readonly h: Handlers,
  ) {}

  start() {
    this.stopped = false;
    this.failures = 0;
    void this.connect();
  }

  stop() {
    this.stopped = true;
    this.closeSse();
    if (this.timer) clearTimeout(this.timer);
    if (this.heartbeat) clearTimeout(this.heartbeat);
    this.timer = null;
    this.heartbeat = null;
    this.setMode('idle');
  }

  private setMode(m: StreamMode) {
    if (this.mode !== m) {
      this.mode = m;
      this.h.onModeChange?.(m);
    }
  }

  private closeSse() {
    if (this.es) {
      this.es.removeAllEventListeners();
      this.es.close();
      this.es = null;
    }
  }

  private resetHeartbeat() {
    if (this.heartbeat) clearTimeout(this.heartbeat);
    this.heartbeat = setTimeout(() => {
      if (this.stopped || this.h.isTerminal()) return;
      this.closeSse();
      this.scheduleReconnect();
    }, HEARTBEAT_MS);
  }

  private async connect() {
    if (this.stopped || this.h.isTerminal()) return;
    const fromSeq = this.h.getLastSeq() + 1;
    const headers = await authHeaders({ guest: true });
    headers.Accept = 'text/event-stream';
    const es = new EventSource<string>(buildUrl(aiApi.streamPath(this.jobId, fromSeq)), {
      headers,
      pollingInterval: 0, // we own reconnection
      timeout: 0,
    });
    this.es = es;

    const handle = (name: string) => (ev: { data: string | null; lastEventId: string | null }) => {
      const parsed = parseFrame(name, ev.data, ev.lastEventId);
      this.resetHeartbeat();
      if (!parsed) return;
      if (!isKnownEventType(parsed.type) && __DEV__) console.log('[stream] unknown event', parsed.type);
      this.failures = 0;
      this.h.onEvents([parsed]);
      if (this.h.isTerminal()) this.stop();
    };

    es.addEventListener('open', () => {
      this.setMode('sse');
      this.resetHeartbeat();
    });
    es.addEventListener('message', handle('message'));
    for (const name of STREAM_EVENT_NAMES) {
      (es as unknown as EventSource<(typeof STREAM_EVENT_NAMES)[number]>).addEventListener(name, (ev) =>
        handle(name)(ev as { data: string | null; lastEventId: string | null }),
      );
    }
    es.addEventListener('error', () => {
      this.closeSse();
      this.failures += 1;
      this.scheduleReconnect();
    });
    es.addEventListener('close', () => {
      if (!this.stopped && !this.h.isTerminal()) this.scheduleReconnect();
    });
  }

  private scheduleReconnect() {
    if (this.stopped || this.h.isTerminal()) return;
    if (this.timer) clearTimeout(this.timer);
    if (shouldFallbackToPolling(this.failures)) {
      this.setMode('polling');
      this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
      return;
    }
    this.setMode('reconnecting');
    this.timer = setTimeout(() => void this.connect(), backoffDelay(this.failures));
  }

  private async poll() {
    if (this.stopped || this.h.isTerminal()) return;
    this.setMode('polling');
    try {
      const events = await aiApi.events(this.jobId, this.h.getLastSeq() + 1);
      if (events.length) this.h.onEvents(events);
    } catch {
      // keep polling; network blips are expected on mobile
    }
    if (this.stopped || this.h.isTerminal()) {
      this.stop();
      return;
    }
    this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
  }

  /** Called on network regain / foreground to retry SSE immediately. */
  kick() {
    if (this.stopped || this.h.isTerminal()) return;
    if (this.timer) clearTimeout(this.timer);
    this.failures = 0;
    this.closeSse();
    void this.connect();
  }
}
