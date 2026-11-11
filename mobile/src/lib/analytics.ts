import { config } from './config';

/**
 * Analytics facade (§11). Events carry ids and enums only — never prompts,
 * code or emails. `platform` is attached to every event.
 *
 * The sink is pluggable: once the Firebase project exists (google-services.json /
 * GoogleService-Info.plist), register `@react-native-firebase/analytics`'s
 * logEvent as the sink in src/lib/bootstrap.ts. Until then events are only
 * logged in development.
 */
export type AnalyticsEvent =
  | 'sign_up'
  | 'login'
  | 'onboarding_complete'
  | 'idea_started'
  | 'requirements_questions'
  | 'requirements_confirmed'
  | 'wireframe_approved'
  | 'generation_started'
  | 'generation_finished'
  | 'deliver_as_is'
  | 'preview_opened'
  | 'chat_turn'
  | 'proposal_applied'
  | 'proposal_discarded'
  | 'checkpoint_restored'
  | 'deploy_launched'
  | 'deploy_succeeded'
  | 'apk_build_started'
  | 'push_opened'
  | 'quota_exhausted';

type Params = Record<string, string | number | boolean | undefined>;
type Sink = (name: AnalyticsEvent, params: Params) => void | Promise<void>;

let sink: Sink | null = null;

const FORBIDDEN = /prompt|code|email|content|message|token/i;

export function setAnalyticsSink(next: Sink | null) {
  sink = next;
}

export function track(name: AnalyticsEvent, params: Params = {}) {
  const safe: Params = { platform: config.platform };
  for (const [k, v] of Object.entries(params)) {
    if (!FORBIDDEN.test(k)) safe[k] = v;
  }
  if (__DEV__ && config.appEnv === 'development') {
    console.log('[analytics]', name, safe);
  }
  try {
    void sink?.(name, safe);
  } catch {
    // analytics must never break the app
  }
}

export function durationBucket(ms: number): string {
  const m = ms / 60000;
  if (m < 1) return '<1m';
  if (m < 3) return '1-3m';
  if (m < 10) return '3-10m';
  if (m < 30) return '10-30m';
  return '30m+';
}
