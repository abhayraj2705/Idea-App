/**
 * Deep-link parsing and validation (§10). Every incoming parameter is
 * validated here before it reaches a screen. Tokens are opaque strings with a
 * conservative charset so nothing executable or path-like slips through.
 */
export type DeepLink =
  | { kind: 'verify-email'; token: string }
  | { kind: 'reset-password'; token: string }
  | { kind: 'team-accept'; token: string }
  | { kind: 'oauth'; code: string; type: string }
  | { kind: 'job'; jobId: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'unknown' };

const TOKEN_RE = /^[A-Za-z0-9._~-]{8,512}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TYPE_RE = /^[a-z_-]{1,32}$/;

export function isValidToken(v: unknown): v is string {
  return typeof v === 'string' && TOKEN_RE.test(v);
}

export function isValidId(v: unknown): v is string {
  return typeof v === 'string' && ID_RE.test(v);
}

/** Accepts https://<domain>/path?x, scheme://path?x and bare /path?x. */
export function parseDeepLink(url: string): DeepLink {
  let path = '';
  let query = '';
  try {
    const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/i);
    if (m) {
      const host = m[1] ?? '';
      const isWeb = /^https?:/i.test(url);
      // For custom schemes the "host" is the first path segment (ideaplatform://oauth?…)
      path = isWeb ? m[2] ?? '' : `/${host}${m[2] ?? ''}`;
      query = m[3] ?? '';
    } else {
      const [p, q] = url.split('?');
      path = p ?? '';
      query = (q ?? '').split('#')[0] ?? '';
    }
  } catch {
    return { kind: 'unknown' };
  }

  const params = new URLSearchParams(query);
  const segs = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const first = segs[0];

  switch (first) {
    case 'verify-email': {
      const token = params.get('token');
      return isValidToken(token) ? { kind: 'verify-email', token } : { kind: 'unknown' };
    }
    case 'reset-password': {
      const token = params.get('token');
      return isValidToken(token) ? { kind: 'reset-password', token } : { kind: 'unknown' };
    }
    case 'team': {
      const token = params.get('token');
      return segs[1] === 'accept' && isValidToken(token) ? { kind: 'team-accept', token } : { kind: 'unknown' };
    }
    case 'oauth': {
      const code = params.get('code');
      const type = params.get('type') ?? 'login';
      return isValidToken(code) && TYPE_RE.test(type) ? { kind: 'oauth', code, type } : { kind: 'unknown' };
    }
    case 'job':
      return isValidId(segs[1]) ? { kind: 'job', jobId: segs[1] } : { kind: 'unknown' };
    case 'project':
      return isValidId(segs[1]) ? { kind: 'project', projectId: segs[1] } : { kind: 'unknown' };
    default:
      return { kind: 'unknown' };
  }
}
