import type { JobEvent } from '@/api/types';
import { applyEvent, applyEvents, initialGenerationState, isTerminal } from '@/features/generation/eventReducer';

const ev = (seq: number, type: string, data?: Record<string, unknown>): JobEvent => ({ seq, type, data });

describe('generation event reducer', () => {
  it('handles every documented stream event type without throwing', () => {
    const types = [
      'phase', 'plan_ready', 'plan_completed', 'module_complete', 'file_checkpoint', 'healing_scan', 'healing_pass',
      'healing_round', 'healing_files', 'healing_convergence', 'typecheck_report', 'compile_report', 'validation_report',
      'verification_report', 'quality_report', 'issue_ledger', 'preview_readiness', 'budget_report', 'completeness_gap',
      'phase_diagnostic', 'token_limit', 'codemod_report', 'repair_report', 'generation_quality_complete',
      'turn', 'delta', 'agent_step', 'proposal', 'scope_upgrade_required', 'complete',
    ];
    const events = types.map((t, i) => ev(i, t, { phase: 'generating', path: `f${i}.ts`, round: 1, text: 'x', proposalId: 'p1' }));
    const s = applyEvents(initialGenerationState, events);
    expect(s.lastSeq).toBe(types.length - 1);
    expect(s.endStatus).toBe('complete');
    expect(s.unknownTypes).toEqual([]);
  });

  it('ignores unknown event types (and records them) instead of crashing', () => {
    const s = applyEvent(initialGenerationState, ev(0, 'brand_new_event_v9', { anything: true }));
    expect(s.lastSeq).toBe(0);
    expect(s.unknownTypes).toEqual(['brand_new_event_v9']);
    expect(s.endStatus).toBeUndefined();
  });

  it('drops replayed events so reconnects never duplicate files', () => {
    const first = applyEvents(initialGenerationState, [ev(0, 'file_checkpoint', { path: 'a.ts' }), ev(1, 'file_checkpoint', { path: 'b.ts' })]);
    // Server replays from an earlier seq after a reconnect
    const replay = applyEvents(first, [ev(0, 'file_checkpoint', { path: 'a.ts' }), ev(1, 'file_checkpoint', { path: 'b.ts' }), ev(2, 'file_checkpoint', { path: 'c.ts' })]);
    expect(replay.files.map((f) => f.path)).toEqual(['c.ts', 'b.ts', 'a.ts']);
    expect(replay.lastSeq).toBe(2);
  });

  it('updates a re-checkpointed file in place rather than adding a duplicate', () => {
    const s = applyEvents(initialGenerationState, [ev(0, 'file_checkpoint', { path: 'a.ts', size: 1 }), ev(1, 'file_checkpoint', { path: 'a.ts', size: 2 })]);
    expect(s.files).toHaveLength(1);
    expect(s.files[0]!.size).toBe(2);
  });

  it('sorts out-of-order batches by seq', () => {
    const s = applyEvents(initialGenerationState, [ev(2, 'complete', { status: 'complete' }), ev(1, 'file_checkpoint', { path: 'a.ts' })]);
    expect(s.files).toHaveLength(1);
    expect(s.endStatus).toBe('complete');
  });

  it('never moves the stage rail backwards', () => {
    let s = applyEvent(initialGenerationState, ev(0, 'healing_round', { round: 1 }));
    expect(s.stage).toBe('heal');
    s = applyEvent(s, ev(1, 'phase', { phase: 'planning' }));
    expect(s.stage).toBe('heal');
  });

  it('tracks healing rounds and convergence', () => {
    const s = applyEvents(initialGenerationState, [
      ev(0, 'healing_round', { round: 3, errorsBefore: 12, errorsAfter: 4 }),
      ev(1, 'healing_convergence', { converged: true, errorsAfter: 0 }),
    ]);
    expect(s.healing).toEqual({ round: 3, errorsBefore: 12, errorsAfter: 0, converged: true });
  });

  it('enters and leaves plan approval', () => {
    let s = applyEvent(initialGenerationState, ev(0, 'plan_ready', { modules: [] }));
    expect(s.planPending).toBe(true);
    expect(s.status).toBe('awaiting_plan_approval');
    s = applyEvent(s, ev(1, 'plan_completed'));
    expect(s.planPending).toBe(false);
    expect(s.status).toBe('running');
  });

  it('maps partial completion with blockers', () => {
    const s = applyEvent(initialGenerationState, ev(0, 'complete', { status: 'partial', blockers: ['Typecheck failed', 3], projectId: 'p1' }));
    expect(s.endStatus).toBe('partial');
    expect(s.blockers).toEqual(['Typecheck failed']);
    expect(s.projectId).toBe('p1');
    expect(isTerminal(s)).toBe(true);
  });

  it('captures errors as a failed end state', () => {
    const s = applyEvent(initialGenerationState, ev(0, 'error', { message: 'Model unavailable' }));
    expect(s.endStatus).toBe('failed');
    expect(s.error).toBe('Model unavailable');
  });

  it('accumulates edit-chat deltas and surfaces proposals', () => {
    const s = applyEvents(initialGenerationState, [
      ev(0, 'turn'),
      ev(1, 'delta', { text: 'Hello ' }),
      ev(2, 'delta', { text: 'world' }),
      ev(3, 'agent_step', { label: 'Read file' }),
      ev(4, 'proposal', { proposalId: 'prop_1' }),
      ev(5, 'scope_upgrade_required'),
    ]);
    expect(s.assistantText).toBe('Hello world');
    expect(s.agentSteps).toHaveLength(1);
    expect(s.proposalId).toBe('prop_1');
    expect(s.scopeUpgradeRequired).toBe(true);
  });

  it('stores reports by type and advances to verify', () => {
    const s = applyEvent(initialGenerationState, ev(0, 'typecheck_report', { errors: 2 }));
    expect(s.reports.typecheck_report).toEqual({ errors: 2 });
    expect(s.stage).toBe('verify');
  });
});
