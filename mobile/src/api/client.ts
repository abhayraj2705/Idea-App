import { clientHeader, config } from '@/lib/config';
import { secureStore } from '@/lib/secureStore';

import type { Envelope } from './types';

/**
 * The single place the `{ success, data, error }` envelope is unwrapped (§8.3).
 * Screens never call fetch; endpoints never touch React.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;

  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }

  get isNetwork() {
    return this.status === 0;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isRateLimited() {
    return this.status === 429;
  }
  get isConflict() {
    return this.status === 409;
  }
  get isServer() {
    return this.status >= 500;
  }
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  auth?: boolean; // default true — attaches the bearer token when present
  guest?: boolean; // attach guestToken
  timeoutMs?: number;
  signal?: AbortSignal;
  idempotencyKey?: string;
  /** Return raw Response (used for streaming fallback / downloads). */
  raw?: boolean;
};

export type Transport = (path: string, opts: RequestOptions) => Promise<unknown>;
let transportOverride: Transport | null = null;
/** Used by the in-app demo backend (api/mock) and by tests. */
export function setTransport(t: Transport | null) {
  transportOverride = t;
}

export function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${config.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

export async function authHeaders(opts: { auth?: boolean; guest?: boolean } = {}): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'X-Client': clientHeader, Accept: 'application/json' };
  if (opts.auth !== false) {
    const token = await secureStore.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (opts.guest) {
    const guestToken = await secureStore.getGuestToken();
    if (guestToken) headers['X-Guest-Token'] = guestToken;
  }
  return headers;
}

/** Pure envelope unwrap — exported for tests. */
export function unwrapEnvelope<T>(status: number, payload: unknown, retryAfter?: number): T {
  const env = payload as Partial<Envelope<T>> | null;
  const looksLikeEnvelope = !!env && typeof env === 'object' && 'success' in env;

  if (status >= 200 && status < 300) {
    if (!looksLikeEnvelope) return payload as T;
    if (env.success) return env.data as T;
    throw new ApiError(status, env.error || 'Request failed', env.code);
  }
  const message =
    (looksLikeEnvelope && env.error) ||
    (status === 429
      ? `Slow down: try again in ${retryAfter ?? 30} s`
      : status >= 500
        ? 'The server had a problem. Please try again.'
        : `Request failed (${status})`);
  throw new ApiError(status, message, looksLikeEnvelope ? env.code : undefined, retryAfter);
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (transportOverride) {
    try {
      return (await transportOverride(path, opts)) as T;
    } catch (e) {
      if (e instanceof ApiError && e.isUnauthorized && opts.auth !== false && (await secureStore.getToken())) {
        onUnauthorized?.();
      }
      throw e;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  opts.signal?.addEventListener('abort', () => controller.abort());

  const headers = { ...(await authHeaders(opts)), ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const aborted = (e as Error)?.name === 'AbortError';
    throw new ApiError(0, aborted ? 'The request timed out.' : "You're offline or the server can't be reached.");
  } finally {
    clearTimeout(timeout);
  }

  if (opts.raw) return res as unknown as T;

  const retryAfterHeader = res.headers.get('Retry-After');
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) || undefined : undefined;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (res.status === 401 && headers.Authorization) onUnauthorized?.();
  return unwrapEnvelope<T>(res.status, payload, retryAfter);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PATCH', body: body ?? {} }),
  del: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE', body }),
};

/** User-facing message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong.';
}
