/**
 * Backend → app shape adapters.
 *
 * The platform backend (Express + Mongoose) wraps most payloads in a named key
 * (`{ projects: [...] }`, `{ user: {...} }`), uses Mongo `_id`, and names some
 * fields differently from the app's types (§3 "Shared types"). Screens are
 * written against `types.ts`; every endpoint maps the server payload through
 * here so no screen ever sees the raw wire format.
 *
 * Each adapter accepts both the wrapped and the bare form, so the app keeps
 * working if the backend later aligns with the documented contract.
 */
import type {
  Capabilities,
  Estimate,
  Job,
  JobEvent,
  JobStatus,
  Project,
  ProjectStatus,
  Wireframe,
  Connection,
  ConnectionCapability,
  DeployProvider,
  FeatureFlags,
  ProjectKind,
  Provider,
  Quota,
  Stack,
  Template,
  User,
} from './types';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** `{ [key]: [...] }` or `[...]` → array. Anything else → empty list. */
export function listOf<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (isObj(data) && Array.isArray(data[key])) return data[key] as T[];
  return [];
}

/** `{ [key]: item }` or `item` → item. */
export function itemOf<T>(data: unknown, key: string): T {
  if (isObj(data) && key in data && (isObj(data[key]) || data[key] === null)) return data[key] as T;
  return data as T;
}

/**
 * Mongo documents carry `_id`; the app keys everything on `id`. Applied to every
 * response in the client, recursively, so nested documents (members, files) get it too.
 */
export function withIds<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withIds) as T;
  if (!isObj(value)) return value;
  const out: Raw = {};
  for (const [k, v] of Object.entries(value)) out[k] = withIds(v);
  if (out.id === undefined && (typeof out._id === 'string' || typeof out._id === 'number')) out.id = String(out._id);
  return out as T;
}

/** "simple-static-blog" → "Simple static blog". Leaves already-readable names alone. */
export function humanize(name: string) {
  if (/\s/.test(name) || !/[-_]/.test(name)) return name;
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toUser(data: unknown): User {
  const u = withIds(itemOf<Raw>(data, 'user')) ?? {};
  return {
    ...(u as unknown as User),
    id: String(u.id ?? ''),
    email: String(u.email ?? ''),
    name: str(u.name),
    avatarUrl: str(u.avatarUrl) || str(u.avatar) || undefined,
    // Login/register omit this; /me has it. Unknown stays undefined (not "unverified").
    emailVerified: u.emailVerified as boolean,
    onboardingCompleted: (u.onboardingCompleted ?? u.hasCompletedOnboarding) as boolean | undefined,
  };
}

export function toSession<T>(data: unknown): T {
  if (isObj(data) && 'user' in data && 'token' in data) return { ...data, user: toUser(data.user) } as T;
  // 2FA challenge: the backend calls the short-lived token `preAuthToken`.
  if (isObj(data) && data.twoFactorRequired) {
    return { twoFactorRequired: true, tempToken: str(data.tempToken) ?? str(data.preAuthToken) ?? '' } as T;
  }
  return data as T;
}

/**
 * The backend reports rolling hourly + daily windows; the app shows one daily
 * meter. A negative or missing limit means unlimited.
 */
export function toQuota(data: unknown): Quota {
  if (!isObj(data)) return { used: 0, limit: null, unlimited: true };
  if ('used' in data && !('daily' in data)) return data as unknown as Quota;
  const w = (isObj(data.daily) ? data.daily : isObj(data.hourly) ? data.hourly : {}) as Raw;
  const limit = typeof w.limit === 'number' && w.limit >= 0 ? w.limit : null;
  const resetInMs = typeof w.resetInMs === 'number' ? w.resetInMs : undefined;
  return {
    used: typeof w.used === 'number' ? w.used : 0,
    limit,
    unlimited: limit == null,
    resetsAt: resetInMs != null ? new Date(Date.now() + resetInMs).toISOString() : undefined,
  };
}

export function toTemplate(raw: Raw): Template {
  const name = String(raw.name ?? 'Template');
  return {
    ...(raw as unknown as Template),
    id: String(raw.id ?? raw._id ?? name),
    name: humanize(name),
    description: str(raw.description),
    stack: str(raw.stack) ?? str(raw.backend),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
    examplePrompt: str(raw.examplePrompt) ?? str(raw.prompt),
  };
}

function stackKind(id: string, scopes: string[]): ProjectKind {
  if (/expo|react-native|mobile|flutter/i.test(id)) return 'mobile';
  if (scopes.includes('fullstack') || scopes.includes('fullApp')) return 'fullstack';
  return 'web';
}

export function toStack(raw: Raw): Stack {
  const id = String(raw.id ?? '');
  const scopes = Array.isArray(raw.supportedScopes) ? (raw.supportedScopes as string[]) : [];
  const caps = raw.capabilities;
  const capabilities = Array.isArray(caps)
    ? (caps as string[])
    : isObj(caps)
      ? Object.entries(caps)
          .filter(([, on]) => !!on)
          .map(([k]) => {
            // "smokeTest" → "Smoke test", "preview" → "Preview"
            const words = k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
            return words.charAt(0).toUpperCase() + words.slice(1);
          })
      : undefined;
  return {
    id,
    name: str(raw.name) ?? str(raw.label) ?? id,
    description: str(raw.description),
    kind: (str(raw.kind) as ProjectKind) ?? stackKind(id, scopes),
    // The backend doesn't grade stacks; anything it offers is treated as supported.
    status: (str(raw.status) as Stack['status']) ?? 'ga',
    capabilities,
  };
}

const FLAG_KEYS: (keyof FeatureFlags)[] = [
  'editChat',
  'mobileBuild',
  'planApprovalGate',
  'generationScope',
  'wireframeGate',
  'frontendPreview',
  'conversationThread',
  'elasticGenerationBudget',
];

export function toCapabilities(data: unknown): Capabilities & { flags: Partial<FeatureFlags> } {
  const d = isObj(data) ? data : {};
  const flags: Partial<FeatureFlags> = {};
  for (const k of FLAG_KEYS) if (typeof d[k] === 'boolean') flags[k] = d[k] as boolean;
  return { stacks: listOf<Raw>(d, 'stacks').map(toStack), flags };
}

export function toProviders(data: unknown): Provider[] {
  return listOf<Raw>(data, 'providers').map((p) => ({
    id: String(p.id),
    name: String(p.name ?? p.id),
    requiresKey: p.requiresKey === true,
    models: listOf<Raw>(p.models, 'models').map((m) => ({
      id: String(m.id),
      name: String(m.name ?? m.id),
      default: !!(m.default ?? m.recommended),
    })),
  }));
}

export function toDeployProviders(data: unknown): DeployProvider[] {
  return listOf<Raw>(data, 'providers').map((p) => ({
    ...(p as unknown as DeployProvider),
    id: String(p.id),
    name: String(p.name ?? p.label ?? p.id),
    connected: !!p.connected,
  }));
}

export function toConnectionCapabilities(data: unknown): ConnectionCapability[] {
  return listOf<Raw>(data, 'capabilities').map((c) => {
    const provider = String(c.provider);
    const mode = str(c.authMode);
    return {
      ...(c as unknown as ConnectionCapability),
      provider,
      name: String(c.name ?? humanize(provider.charAt(0).toUpperCase() + provider.slice(1))),
      oauth: typeof c.oauth === 'boolean' ? c.oauth : mode === 'oauth',
      pat: typeof c.pat === 'boolean' ? c.pat : mode === 'pat' || mode === 'token',
    };
  });
}

export function toConnections(data: unknown): Connection[] {
  return listOf<Connection>(data, 'connections');
}

export function toDbEngines(data: unknown): { id: string; name: string }[] {
  return listOf<Raw>(data, 'engines')
    .filter((e) => e.available !== false)
    .map((e) => {
      const id = String(e.id ?? e.engine);
      return { id, name: String(e.name ?? id.charAt(0).toUpperCase() + id.slice(1)) };
    });
}

export function toSdk(data: unknown): { versions: string[]; latest: string } {
  const d = isObj(data) ? data : {};
  const versions = (Array.isArray(d.versions) ? d.versions : Array.isArray(d.supported) ? d.supported : []).map(String);
  return { versions, latest: String(d.latest ?? versions[versions.length - 1] ?? '') };
}

// ── Generation ───────────────────────────────────────────────────────

/**
 * The backend's wireframe is `{ pages: [{ name, path, sections: [{ type, label }] }] }`.
 * The screen list is derived for display; the original spec is kept in `raw`
 * because the generate request sends it back as the approved wireframe.
 */
export function toWireframe(data: unknown): Wireframe {
  const spec = itemOf<Raw>(data, 'wireframe') ?? {};
  const pages = listOf<Raw>(spec, 'pages');
  const screens = pages.length
    ? pages.map((p) => ({
        name: String(p.name ?? p.path ?? 'Screen'),
        description: String(p.description ?? p.path ?? ''),
        elements: listOf<Raw>(p.sections, 'sections')
          .map((sec) => str(sec.label) ?? (str(sec.type) ? humanize(String(sec.type)) : undefined))
          .filter((x): x is string => !!x),
      }))
    : listOf<Wireframe['screens'][number]>(spec, 'screens');
  return { id: String(spec.id ?? 'wireframe'), screens, raw: spec };
}

export function toEstimate(data: unknown): Estimate {
  const e = itemOf<Raw>(data, 'estimate') ?? {};
  const tokens = Number(e.tokens ?? e.estimatedTotalTokens ?? 0) || 0;
  return {
    tokens,
    minutes: typeof e.minutes === 'number' ? e.minutes : undefined,
    risk: str(e.risk),
    mode: str(e.recommendedMode) ?? str(e.mode),
  };
}

const RUNNING = new Set(['planning', 'generating', 'validating', 'healing', 'verifying', 'runtime_verifying', 'running']);

/** Server job statuses are finer-grained than the app's lifecycle. */
export function toJobStatus(status: unknown): JobStatus {
  const s = String(status ?? 'queued');
  if (RUNNING.has(s)) return 'running';
  if (s === 'awaiting_approval') return 'awaiting_plan_approval';
  if (s === 'canceled') return 'cancelled';
  return s as JobStatus;
}

export function toJob(raw: unknown): Job {
  const j = withIds((itemOf<Raw>(raw, 'job') ?? {}) as Raw);
  const req = isObj(j.requirements) ? j.requirements : {};
  const terminal = ['complete', 'failed', 'partial', 'canceled'].includes(String(j.status));
  return {
    ...(j as unknown as Job),
    id: String(j.id ?? ''),
    projectId: j.projectId ? String(j.projectId) : undefined,
    projectName: str(j.projectName) ?? (str(req.projectName) ? humanize(String(req.projectName)) : undefined),
    stack: str(j.stack) ?? stackName(str(j.resolvedStackId) || str(j.stackId)),
    status: toJobStatus(j.status),
    phase: str(j.phase),
    progress: typeof j.progress === 'number' ? j.progress : undefined,
    createdAt: str(j.createdAt),
    updatedAt: str(j.updatedAt),
    finishedAt: str(j.finishedAt) ?? str(j.completedAt) ?? (terminal ? str(j.updatedAt) : undefined),
  };
}

/** `/jobs/:id/events` returns transcript rows `{ seq, type, payload }`; the reducer reads `data`. */
export function toJobEvents(data: unknown): JobEvent[] {
  return listOf<Raw>(data, 'events')
    .filter((e) => typeof e.seq === 'number' && typeof e.type === 'string')
    .map((e) => ({ seq: e.seq as number, type: e.type as string, data: (isObj(e.payload) ? e.payload : isObj(e.data) ? e.data : {}) as Record<string, unknown> }));
}

// ── Projects ─────────────────────────────────────────────────────────

const STACK_NAMES: Record<string, string> = {
  'nextjs-express-mongo': 'Next.js + Express',
  'react-django-postgres': 'React + Django',
  'svelte-fastapi-mongo': 'SvelteKit + FastAPI',
  'react-rails-postgres': 'React + Rails',
  'vue-laravel-mysql': 'Vue + Laravel',
  'htmx-flask-sqlite': 'HTMX + Flask',
  'react-native-expo-mongo': 'React Native (Expo)',
};

/** Readable stack name for an id ("nextjs-express-mongo" → "Next.js + Express"). */
export function stackName(id?: string) {
  return id ? (STACK_NAMES[id] ?? id) : undefined;
}

export function toProject(raw: unknown): Project {
  const p = withIds((itemOf<Raw>(raw, 'project') ?? {}) as Raw);
  const stackId = str(p.stackId) ?? '';
  const status = str(p.status);
  return {
    ...(p as unknown as Project),
    id: String(p.id ?? ''),
    name: String(p.name ?? 'Untitled'),
    stack: str(p.stack) ?? stackName(stackId || undefined),
    kind: (str(p.kind) as Project['kind']) ?? (stackId ? stackKind(stackId, p.scope === 'frontend' ? ['frontend'] : ['fullstack']) : undefined),
    status: (status === 'generating' || status === 'complete' || status === 'failed' || status === 'partial' ? status : undefined) as ProjectStatus | undefined,
    ownerId: p.ownerId ? String(p.ownerId) : p.userId ? String(isObj(p.userId) ? (p.userId as Raw).id ?? (p.userId as Raw)._id : p.userId) : undefined,
    teamShared: typeof p.teamShared === 'boolean' ? p.teamShared : !!p.isTeamShared,
    isPublic: !!p.isPublic,
    fileCount: typeof p.fileCount === 'number' ? p.fileCount : Array.isArray(p.files) ? p.files.length : undefined,
  };
}
