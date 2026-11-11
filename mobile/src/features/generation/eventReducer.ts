import type { JobEvent, JobStatus } from '@/api/types';

/**
 * Pure reducer for the generation job stream (§5.3, §7.3).
 *
 * Rules:
 *  - Events with seq <= lastSeq are dropped, so replay after reconnect never
 *    duplicates files or reports.
 *  - Unknown event types are ignored (and counted for logging), never a crash.
 */
export const STAGES = ['plan', 'generate', 'verify', 'heal', 'finalise'] as const;
export type Stage = (typeof STAGES)[number];

export type FileEntry = { path: string; size?: number; seq: number; content?: string };
export type HealingInfo = { round: number; errorsBefore?: number; errorsAfter?: number; converged?: boolean };
export type EndStatus = 'complete' | 'partial' | 'failed' | 'cancelled';

export type GenerationState = {
  lastSeq: number;
  status: JobStatus;
  stage: Stage;
  phaseLabel?: string;
  files: FileEntry[];
  healing?: HealingInfo;
  reports: Record<string, Record<string, unknown>>;
  plan?: Record<string, unknown>;
  planPending: boolean;
  modulesDone: number;
  endStatus?: EndStatus;
  blockers?: string[];
  error?: string;
  tokenLimitHit: boolean;
  projectId?: string;
  unknownTypes: string[];
  // Edit chat
  assistantText: string;
  agentSteps: { seq: number; label: string }[];
  proposalId?: string;
  scopeUpgradeRequired: boolean;
};

export const initialGenerationState: GenerationState = {
  lastSeq: -1,
  status: 'queued',
  stage: 'plan',
  files: [],
  reports: {},
  planPending: false,
  modulesDone: 0,
  tokenLimitHit: false,
  unknownTypes: [],
  assistantText: '',
  agentSteps: [],
  scopeUpgradeRequired: false,
};

const REPORT_TYPES = new Set([
  'typecheck_report',
  'compile_report',
  'validation_report',
  'verification_report',
  'quality_report',
  'issue_ledger',
  'preview_readiness',
  'budget_report',
  'codemod_report',
  'repair_report',
  'completeness_gap',
  'phase_diagnostic',
]);

const KNOWN_TYPES = new Set([
  // Platform backend names (generation-runner.ts / generation-job.routes.ts)
  'job', 'queued', 'resuming', 'warning', 'plan', 'scope', 'file', 'file_healed', 'preview_file', 'preview_ready',
  'failover', 'handoff', 'schema_drift', 'candidate_demoted', 'capability_unavailable', 'capability_not_applicable',
  'db_validation_report', 'canceled', 'stream_end',
  'phase',
  'plan_ready',
  'plan_completed',
  'module_complete',
  'file_checkpoint',
  'healing_scan',
  'healing_pass',
  'healing_round',
  'healing_files',
  'healing_convergence',
  'token_limit',
  'generation_quality_complete',
  'complete',
  'error',
  'turn',
  'delta',
  'agent_step',
  'proposal',
  'scope_upgrade_required',
  ...REPORT_TYPES,
]);

export function isKnownEventType(type: string) {
  return KNOWN_TYPES.has(type);
}

function phaseToStage(phase: string, current: Stage): Stage {
  const p = phase.toLowerCase();
  if (/plan|requirement|architect/.test(p)) return 'plan';
  if (/generat|scaffold|module|write|code/.test(p)) return 'generate';
  if (/verif|valid|typecheck|compile|test|lint/.test(p)) return 'verify';
  if (/heal|repair|fix/.test(p)) return 'heal';
  if (/final|deliver|package|done|complete/.test(p)) return 'finalise';
  return current;
}

const stageIndex = (s: Stage) => STAGES.indexOf(s);
/** Stages only move forward (a late `phase` replay must not rewind the rail). */
const advance = (current: Stage, next: Stage): Stage => (stageIndex(next) > stageIndex(current) ? next : current);

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

export function applyEvent(state: GenerationState, event: JobEvent): GenerationState {
  if (event.type === 'stream_end') return applyStreamEnd(state, (event.data ?? {}) as Record<string, unknown>);
  if (typeof event.seq === 'number' && event.seq <= state.lastSeq) return state;
  const d = (event.data ?? {}) as Record<string, unknown>;
  const s: GenerationState = { ...state, lastSeq: typeof event.seq === 'number' ? event.seq : state.lastSeq };
  if (s.status === 'queued') s.status = 'running';

  switch (event.type) {
    case 'phase': {
      const phase = str(d.phase) ?? str(d.name) ?? '';
      s.phaseLabel = str(d.label) ?? str(d.message) ?? phase;
      s.stage = advance(s.stage, phaseToStage(phase, s.stage));
      return s;
    }
    case 'plan_ready':
      s.plan = d;
      s.planPending = d.requiresApproval !== false;
      if (s.planPending) s.status = 'awaiting_plan_approval';
      return s;
    case 'plan_completed':
      s.planPending = false;
      s.status = 'running';
      s.stage = advance(s.stage, 'generate');
      return s;
    case 'module_complete':
      s.modulesDone += 1;
      s.stage = advance(s.stage, 'generate');
      return s;
    case 'file':
    case 'file_checkpoint': {
      const path = str(d.path);
      if (!path) return s;
      const content = str(d.content);
      const entry: FileEntry = { path, size: num(d.size) ?? (content != null ? content.length : undefined), seq: event.seq, content };
      const idx = s.files.findIndex((f) => f.path === path);
      s.files = idx >= 0 ? s.files.map((f, i) => (i === idx ? entry : f)) : [entry, ...s.files];
      s.stage = advance(s.stage, 'generate');
      return s;
    }
    case 'healing_scan':
    case 'healing_pass':
    case 'healing_files':
      s.stage = advance(s.stage, 'heal');
      return s;
    case 'healing_round':
      s.stage = advance(s.stage, 'heal');
      s.healing = {
        ...s.healing,
        round: num(d.round) ?? (s.healing?.round ?? 0) + 1,
        errorsBefore: num(d.errorsBefore) ?? num(d.before) ?? s.healing?.errorsBefore,
        errorsAfter: num(d.errorsAfter) ?? num(d.after) ?? s.healing?.errorsAfter,
      };
      return s;
    case 'healing_convergence':
      s.healing = {
        round: s.healing?.round ?? 0,
        ...s.healing,
        errorsAfter: num(d.errorsAfter) ?? num(d.remaining) ?? s.healing?.errorsAfter,
        converged: d.converged === true,
      };
      return s;
    case 'token_limit':
      s.tokenLimitHit = true;
      return s;
    case 'generation_quality_complete':
      s.stage = advance(s.stage, 'finalise');
      return s;
    case 'complete': {
      const status = str(d.status);
      s.endStatus = status === 'partial' ? 'partial' : status === 'failed' ? 'failed' : 'complete';
      s.status = s.endStatus === 'complete' ? 'complete' : s.endStatus === 'partial' ? 'partial' : 'failed';
      s.stage = 'finalise';
      s.projectId = str(d.projectId) ?? s.projectId;
      if (Array.isArray(d.blockers)) s.blockers = d.blockers.filter((b): b is string => typeof b === 'string');
      s.planPending = false;
      return s;
    }
    case 'canceled':
      s.status = 'cancelled';
      s.planPending = false;
      return s;
    case 'error':
      s.endStatus = 'failed';
      s.status = 'failed';
      s.error = str(d.message) ?? str(d.error) ?? 'Generation failed';
      return s;

    // Edit chat stream
    case 'turn':
      s.assistantText = '';
      return s;
    case 'delta':
      s.assistantText += str(d.text) ?? str(d.delta) ?? '';
      return s;
    case 'agent_step':
      s.agentSteps = [...s.agentSteps, { seq: event.seq, label: str(d.label) ?? str(d.step) ?? 'Working…' }];
      return s;
    case 'proposal':
      {
        const nested = (d.proposal && typeof d.proposal === 'object' ? d.proposal : {}) as Record<string, unknown>;
        s.proposalId = str(d.proposalId) ?? str(d.id) ?? str(nested.id) ?? str(nested._id) ?? str(nested.proposalId);
      }
      return s;
    case 'scope_upgrade_required':
      s.scopeUpgradeRequired = true;
      return s;

    default:
      if (REPORT_TYPES.has(event.type)) {
        s.reports = { ...s.reports, [event.type]: d };
        if (event.type === 'verification_report' || event.type === 'typecheck_report' || event.type === 'validation_report') {
          s.stage = advance(s.stage, 'verify');
        }
        return s;
      }
      if (!s.unknownTypes.includes(event.type)) s.unknownTypes = [...s.unknownTypes, event.type];
      return s;
  }
}

export function applyEvents(state: GenerationState, events: JobEvent[]): GenerationState {
  // Seq-less frames (stream_end, seq -1) close the stream, so they always apply last.
  const order = (e: JobEvent) => (e.seq < 0 ? Number.POSITIVE_INFINITY : e.seq);
  return [...events].sort((a, b) => order(a) - order(b)).reduce(applyEvent, state);
}

/**
 * Final status from the server when it closes the stream. `complete` events
 * don't say whether the run finished with issues; this does.
 */
function applyStreamEnd(state: GenerationState, d: Record<string, unknown>): GenerationState {
  const status = str(d.status);
  if (status === 'canceled' || status === 'cancelled') return { ...state, status: 'cancelled', planPending: false };
  if (status !== 'complete' && status !== 'partial' && status !== 'failed') return state;
  return { ...state, endStatus: status, status, stage: status === 'failed' ? state.stage : 'finalise', planPending: false };
}

export function isTerminal(state: GenerationState) {
  return !!state.endStatus || state.status === 'cancelled';
}

/** Human summary used for screen-reader announcements on stage change. */
export const STAGE_LABEL: Record<Stage, string> = {
  plan: 'Plan',
  generate: 'Generate',
  verify: 'Verify',
  heal: 'Heal',
  finalise: 'Finalise',
};
