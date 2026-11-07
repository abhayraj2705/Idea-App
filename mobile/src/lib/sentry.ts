import * as Sentry from '@sentry/react-native';

import { config } from './config';

let enabled = false;

const SCRUB_KEYS = /authorization|token|password|prompt|content|code|secret|apikey|api_key|email/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SCRUB_KEYS.test(k) ? '[scrubbed]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

/** No-op unless a DSN is configured (same pattern as the backend). */
export function initSentry() {
  if (!config.sentryDsn || enabled) return;
  enabled = true;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.appEnv,
    release: `ideaplatform-mobile@${config.appVersion}+${config.buildNumber}`,
    sendDefaultPii: false,
    tracesSampleRate: config.appEnv === 'production' ? 0.1 : 1,
    beforeSend(event) {
      if (event.request) {
        event.request.headers = undefined;
        event.request.cookies = undefined;
        event.request.data = undefined;
      }
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.data) crumb.data = scrub(crumb.data) as typeof crumb.data;
      return crumb;
    },
  });
}

export function captureError(error: unknown, tags?: Record<string, string>) {
  if (!enabled) {
    if (__DEV__) console.warn('[error]', error, tags);
    return;
  }
  Sentry.withScope((scope) => {
    if (tags) for (const [k, v] of Object.entries(tags)) scope.setTag(k, v);
    Sentry.captureException(error);
  });
}

export function setSentryUser(id: string | null) {
  if (enabled) Sentry.setUser(id ? { id } : null);
}

export function setSentryTag(key: string, value: string | null) {
  if (enabled) Sentry.setTag(key, value ?? undefined);
}
