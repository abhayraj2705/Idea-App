import { ApiError, buildUrl, errorMessage, unwrapEnvelope } from '@/api/client';

describe('API envelope unwrap', () => {
  it('returns data on success', () => {
    expect(unwrapEnvelope(200, { success: true, data: { id: 1 }, error: null })).toEqual({ id: 1 });
  });

  it('passes through non-envelope 2xx payloads', () => {
    expect(unwrapEnvelope(200, [1, 2])).toEqual([1, 2]);
  });

  it('throws ApiError with the server message when success is false', () => {
    expect(() => unwrapEnvelope(200, { success: false, data: null, error: 'Nope', code: 'X' })).toThrow(ApiError);
    try {
      unwrapEnvelope(200, { success: false, data: null, error: 'Nope', code: 'X' });
    } catch (e) {
      expect((e as ApiError).message).toBe('Nope');
      expect((e as ApiError).code).toBe('X');
    }
  });

  it('maps 401 / 409 / 5xx to typed errors', () => {
    const get = (status: number, body: unknown = null) => {
      try {
        unwrapEnvelope(status, body);
      } catch (e) {
        return e as ApiError;
      }
      throw new Error('expected throw');
    };
    expect(get(401, { success: false, data: null, error: 'Expired' }).isUnauthorized).toBe(true);
    expect(get(409).isConflict).toBe(true);
    const server = get(503);
    expect(server.isServer).toBe(true);
    expect(server.message).toMatch(/server had a problem/i);
  });

  it('uses Retry-After for 429 messages', () => {
    try {
      unwrapEnvelope(429, null, 12);
    } catch (e) {
      expect((e as ApiError).isRateLimited).toBe(true);
      expect((e as ApiError).retryAfter).toBe(12);
      expect((e as ApiError).message).toBe('Slow down: try again in 12 s');
    }
  });

  it('builds URLs and drops empty query params', () => {
    const url = buildUrl('/api/x', { a: 1, b: undefined, c: null, d: 'h i' });
    expect(url).toMatch(/\/api\/x\?a=1&d=h%20i$/);
  });

  it('produces user-facing messages for any thrown value', () => {
    expect(errorMessage(new ApiError(0, 'Offline'))).toBe('Offline');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('weird')).toBe('Something went wrong.');
  });
});
