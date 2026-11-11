import { ApiError, authHeaders, buildUrl } from './client';

/**
 * POST a JSON body and read the response as it arrives.
 *
 * Several backend endpoints (generate/v2 without a queue, chat/v2) do their
 * work *inside* the request and stream Server-Sent Events back. React Native's
 * fetch can't read a body incrementally, so this uses XMLHttpRequest, whose
 * `responseText` grows as data arrives.
 *
 * - Each SSE frame's JSON is passed to `onEvent` (the event name comes from the
 *   `event:` line or the payload's `type`).
 * - A JSON response (e.g. `202 { jobId }`) is passed to `onJson` instead.
 * - Error statuses reject with the server's `error` message.
 */
export type SseEvent = { type: string; data: Record<string, unknown> };

export type SseRequest = {
  /** Settles when the response has fully ended. */
  done: Promise<void>;
  /** Closes the connection. For inline work the server treats this as a cancel. */
  abort: () => void;
};

type Options = {
  body: unknown;
  onEvent?: (e: SseEvent) => void;
  onJson?: (json: Record<string, unknown>) => void;
  headers?: Record<string, string>;
  guest?: boolean;
};

const parse = (text: string): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

export function sseRequest(path: string, { body, onEvent, onJson, headers: extra, guest = true }: Options): SseRequest {
  const xhr = new XMLHttpRequest();
  let consumed = 0;
  let buffer = '';
  let aborted = false;

  const flushFrames = () => {
    const text = xhr.responseText ?? '';
    if (text.length <= consumed) return;
    buffer += text.slice(consumed);
    consumed = text.length;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      let name: string | undefined;
      const lines: string[] = [];
      for (const line of frame.split(/\r?\n/)) {
        if (line.startsWith('event:')) name = line.slice(6).trim();
        else if (line.startsWith('data:')) lines.push(line.slice(5).trimStart());
      }
      const data = lines.length ? parse(lines.join('\n')) : null;
      if (!data) continue;
      const type = name ?? (typeof data.type === 'string' ? data.type : undefined);
      if (type) onEvent?.({ type, data });
    }
  };

  const done = new Promise<void>((resolve, reject) => {
    void authHeaders({ guest }).then((headers) => {
      if (aborted) return resolve();
      const isJson = () => (xhr.getResponseHeader('content-type') ?? '').includes('application/json');

      xhr.onreadystatechange = () => {
        if (xhr.readyState < 3) return;
        if (xhr.status >= 400 || isJson()) {
          if (xhr.readyState !== 4) return;
          const json = parse(xhr.responseText ?? '');
          if (xhr.status >= 400) {
            reject(new ApiError(xhr.status, String(json?.error ?? `Request failed (${xhr.status})`), typeof json?.code === 'string' ? json.code : undefined));
          } else {
            if (json) onJson?.(json);
            resolve();
          }
          return;
        }
        flushFrames();
        if (xhr.readyState === 4) resolve();
      };
      xhr.onerror = () => (aborted ? resolve() : reject(new ApiError(0, "You're offline or the server can't be reached.")));
      xhr.onabort = () => resolve();

      xhr.open('POST', buildUrl(path));
      for (const [k, v] of Object.entries({ ...headers, ...extra })) xhr.setRequestHeader(k, v);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Accept', 'text/event-stream, application/json');
      xhr.send(JSON.stringify(body));
    }, reject);
  });

  return {
    done,
    abort: () => {
      aborted = true;
      xhr.abort();
    },
  };
}
