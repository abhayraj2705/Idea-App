import {
  humanize,
  itemOf,
  listOf,
  toCapabilities,
  toDbEngines,
  toProviders,
  toQuota,
  toSession,
  toTemplate,
  toUser,
  withIds,
} from '@/api/adapters';
import type { AuthSession } from '@/api/types';

// Payloads below are trimmed copies of what the platform backend actually returns.

describe('listOf / itemOf', () => {
  it('unwraps the named key the backend uses', () => {
    expect(listOf({ projects: [{ id: 'a' }] }, 'projects')).toEqual([{ id: 'a' }]);
    expect(itemOf({ team: null }, 'team')).toBeNull();
  });
  it('accepts the bare form too', () => {
    expect(listOf([{ id: 'a' }], 'projects')).toEqual([{ id: 'a' }]);
    expect(itemOf({ id: 'p1', name: 'x' }, 'project')).toEqual({ id: 'p1', name: 'x' });
  });
  it('never returns a non-array for a list (the Home crash)', () => {
    expect(listOf({ jobs: undefined }, 'jobs')).toEqual([]);
    expect(listOf(null, 'jobs')).toEqual([]);
  });
});

describe('withIds', () => {
  it('copies Mongo _id to id, recursively, without overwriting an existing id', () => {
    const out = withIds({ _id: 'u1', members: [{ _id: 'm1' }], nested: { id: 'keep', _id: 'other' } });
    expect(out).toMatchObject({ id: 'u1', members: [{ id: 'm1' }], nested: { id: 'keep' } });
  });
});

describe('toUser / toSession', () => {
  it('maps /me ({ user: {...} }) to the app user', () => {
    const user = toUser(
      withIds({ user: { _id: 'u1', email: 'a@b.co', name: 'A', avatar: 'https://x/a.png', emailVerified: false, hasCompletedOnboarding: true } }),
    );
    expect(user).toMatchObject({ id: 'u1', email: 'a@b.co', avatarUrl: 'https://x/a.png', emailVerified: false, onboardingCompleted: true });
  });
  it('leaves emailVerified unknown when login omits it (no false "verify your email" banner)', () => {
    const s = toSession<AuthSession>({ token: 't', user: { id: 'u1', email: 'a@b.co', hasCompletedOnboarding: false } });
    expect(s.token).toBe('t');
    expect(s.user.emailVerified).toBeUndefined();
    expect(s.user.onboardingCompleted).toBe(false);
  });
  it('passes a 2FA challenge through untouched', () => {
    expect(toSession({ twoFactorRequired: true, tempToken: 'x' })).toEqual({ twoFactorRequired: true, tempToken: 'x' });
  });
  it("maps the backend's 2FA preAuthToken to the app's tempToken", () => {
    expect(toSession({ twoFactorRequired: true, preAuthToken: 'pre' })).toEqual({ twoFactorRequired: true, tempToken: 'pre' });
  });
});

describe('toQuota', () => {
  it('uses the daily window', () => {
    const q = toQuota({ hourly: { used: 1, limit: 8, resetInMs: 1000 }, daily: { used: 3, limit: 20, resetInMs: 60_000 } });
    expect(q).toMatchObject({ used: 3, limit: 20, unlimited: false });
    expect(typeof q.resetsAt).toBe('string');
  });
  it('treats a negative limit as unlimited', () => {
    expect(toQuota({ daily: { used: 0, limit: -1 } })).toMatchObject({ limit: null, unlimited: true });
  });
  it('accepts the documented shape unchanged', () => {
    expect(toQuota({ used: 2, limit: 10 })).toEqual({ used: 2, limit: 10 });
  });
});

describe('catalogue adapters', () => {
  it('templates get readable names and the backend stack', () => {
    expect(toTemplate({ _id: 't1', name: 'simple-static-blog', backend: 'express-mongoose' })).toMatchObject({
      id: 't1',
      name: 'Simple static blog',
      stack: 'express-mongoose',
    });
    expect(humanize('Online shop')).toBe('Online shop');
  });

  it('stacks: label → name, capability object → list, kind inferred, flags extracted', () => {
    const caps = toCapabilities({
      generationScope: false,
      wireframeGate: true,
      queueMode: 'inline-degraded',
      stacks: [
        { id: 'react-native-expo-mongo', label: 'React Native (Expo) + Express', supportedScopes: ['fullstack'], capabilities: { preview: true, deploy: false } },
        { id: 'nextjs-express-mongo', label: 'Next.js + Express', supportedScopes: ['fullstack', 'frontend'], capabilities: { smokeTest: true } },
      ],
    });
    expect(caps.flags).toEqual({ generationScope: false, wireframeGate: true });
    expect(caps.stacks[0]).toMatchObject({ name: 'React Native (Expo) + Express', kind: 'mobile', status: 'ga', capabilities: ['Preview'] });
    expect(caps.stacks[1]).toMatchObject({ kind: 'fullstack', capabilities: ['Smoke test'] });
  });

  it('providers mark the recommended model as default', () => {
    const [p] = toProviders({ providers: [{ id: 'github', name: 'GitHub', models: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', recommended: true }] }] });
    expect(p!.models.find((m) => m.default)?.id).toBe('b');
  });

  it('db engines drop unavailable ones', () => {
    expect(toDbEngines({ engines: [{ engine: 'postgres', available: true }, { engine: 'mysql', available: false }] })).toEqual([
      { id: 'postgres', name: 'Postgres' },
    ]);
  });
});
