import { MAX_BACKOFF_MS, backoffDelay, parseFrame, shouldFallbackToPolling } from '@/features/generation/jobStream';

describe('job stream reconnect logic', () => {
  it('backs off exponentially and caps at 30 s', () => {
    expect([0, 1, 2, 3, 4].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(backoffDelay(5)).toBe(MAX_BACKOFF_MS);
    expect(backoffDelay(50)).toBe(MAX_BACKOFF_MS);
  });

  it('falls back to polling after 3 consecutive SSE failures', () => {
    expect(shouldFallbackToPolling(2)).toBe(false);
    expect(shouldFallbackToPolling(3)).toBe(true);
  });
});

describe('SSE frame parsing', () => {
  it('reads named events with seq from the id field', () => {
    expect(parseFrame('file_checkpoint', JSON.stringify({ path: 'a.ts' }), '7')).toEqual({ seq: 7, type: 'file_checkpoint', data: { path: 'a.ts' } });
  });

  it('reads message frames carrying {type, seq, data}', () => {
    expect(parseFrame('message', JSON.stringify({ type: 'phase', seq: 3, data: { phase: 'plan' } }), null)).toEqual({ seq: 3, type: 'phase', data: { phase: 'plan' } });
  });

  it('returns null for garbage, missing type or missing seq', () => {
    expect(parseFrame('message', 'not json', '1')).toBeNull();
    expect(parseFrame('message', JSON.stringify({ seq: 1 }), null)).toBeNull();
    expect(parseFrame('phase', JSON.stringify({}), null)).toBeNull();
    expect(parseFrame('phase', null, '1')).toBeNull();
  });
});
