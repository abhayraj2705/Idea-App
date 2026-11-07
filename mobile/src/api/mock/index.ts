/**
 * In-memory demo backend. Enabled only with MOCK_API=1 / EXPO_PUBLIC_MOCK_API=1 in
 * non-production builds (see app.config.ts). It mirrors the §5 contract closely
 * enough to exercise every screen end to end without the real backend, including
 * time-scripted generation and edit-chat streams served via /events polling.
 */
import { ApiError, setTransport, type RequestOptions } from '../client';
import type {
  ChatMessage,
  Checkpoint,
  Deployment,
  EditProposal,
  Job,
  JobEvent,
  MobileBuild,
  NotificationPreferences,
  Project,
  Team,
  Template,
  User,
} from '../types';

const now = () => new Date().toISOString();
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
let idc = 1000;
const nid = (p: string) => `${p}${(idc++).toString(36)}`;

const SAMPLE_APP = `import { useState } from 'react';

// A tiny habit tracker screen
export default function Habits() {
  const [habits, setHabits] = useState<string[]>(['Read', 'Walk']);
  const add = (name: string) => setHabits((h) => [...h, name]);
  return (
    <main className="p-6">
      <h1>Habits ({habits.length})</h1>
      {habits.map((h) => <p key={h}>{h}</p>)}
    </main>
  );
}
`;

const db = {
  token: null as string | null,
  user: {
    id: 'u_demo',
    email: 'demo@ideaplatform.app',
    name: 'Demo User',
    emailVerified: true,
    twoFactorEnabled: false,
    onboardingCompleted: true,
    defaultStack: 'nextjs',
    apiKeys: [],
    createdAt: ago(60 * 24 * 30),
  } as User,
  projects: [
    {
      id: 'p_habits',
      name: 'Habit Streaks',
      description: 'A habit tracker with streaks and reminders',
      stack: 'Next.js + Prisma',
      kind: 'fullstack',
      status: 'complete',
      fileCount: 4,
      ownerId: 'u_demo',
      teamShared: false,
      isPublic: false,
      updatedAt: ago(42),
      createdAt: ago(600),
      previewReadiness: { ready: true },
      files: [
        { path: 'app/page.tsx', content: SAMPLE_APP, size: SAMPLE_APP.length },
        { path: 'app/layout.tsx', content: "export default function Layout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n", size: 90 },
        { path: 'prisma/schema.prisma', content: 'model Habit {\n  id    String @id @default(cuid())\n  name  String\n  streak Int @default(0)\n}\n', size: 96 },
        { path: 'package.json', content: '{\n  "name": "habit-streaks",\n  "private": true\n}\n', size: 48 },
      ],
    },
    {
      id: 'p_yoga',
      name: 'Studio Bookings',
      description: 'Class schedule and sign-ups for a yoga studio',
      stack: 'Expo (React Native)',
      kind: 'mobile',
      status: 'partial',
      fileCount: 2,
      ownerId: 'u_demo',
      updatedAt: ago(60 * 26),
      createdAt: ago(60 * 30),
      files: [
        { path: 'App.tsx', content: "import { Text } from 'react-native';\nexport default function App() {\n  return <Text>Classes</Text>;\n}\n", size: 92 },
        { path: 'app.json', content: '{ "expo": { "name": "studio" } }\n', size: 34 },
      ],
    },
  ] as Project[],
  templates: [
    { id: 't_saas', name: 'SaaS starter', description: 'Auth, billing-ready dashboard and settings.', stack: 'nextjs', kind: 'fullstack', tags: ['auth', 'dashboard'], examplePrompt: 'A SaaS dashboard for tracking customer feedback with tags and charts' },
    { id: 't_shop', name: 'Online shop', description: 'Catalogue, cart and checkout pages.', stack: 'nextjs', kind: 'web', tags: ['e-commerce'], examplePrompt: 'A small online shop for handmade candles with a cart' },
    { id: 't_fit', name: 'Fitness app', description: 'Workouts, timers and progress charts.', stack: 'expo', kind: 'mobile', tags: ['health'], examplePrompt: 'A workout app with interval timers and weekly progress charts' },
    { id: 't_blog', name: 'Blog', description: 'Markdown posts, tags and RSS.', stack: 'nextjs', kind: 'web', tags: ['content'], examplePrompt: 'A personal blog with markdown posts, tags and an RSS feed' },
  ] as Template[],
  jobs: [] as (Job & { script: { at: number; type: string; data?: Record<string, unknown> }[]; startedAt: number; kind: 'gen' | 'chat'; meta?: Record<string, string> })[],
  conversations: new Map<string, { id: string; projectId: string }>(),
  messages: new Map<string, ChatMessage[]>(),
  checkpoints: new Map<string, Checkpoint[]>(),
  proposals: new Map<string, EditProposal>(),
  team: null as Team | null,
  connections: [] as { id: string; provider: string; account?: string; createdAt?: string }[],
  deployments: [] as (Deployment & { startedAt: number })[],
  builds: [] as (MobileBuild & { startedAt: number })[],
  prefs: { generation: true, planReady: true, builds: true, deploys: true, teamInvites: true } as NotificationPreferences,
  quotaUsed: 2,
};

db.checkpoints.set('p_habits', [
  { id: 'c1', label: 'Initial generation', createdAt: ago(600), fileCount: 4 },
  { id: 'c2', label: 'Added streak counter', createdAt: ago(42), fileCount: 4 },
]);

function genScript(name: string) {
  const files = ['package.json', 'app/layout.tsx', 'app/page.tsx', 'app/api/items/route.ts', 'components/Header.tsx', 'components/List.tsx', 'lib/db.ts', 'prisma/schema.prisma', 'styles/globals.css', 'README.md'];
  const s: { at: number; type: string; data?: Record<string, unknown> }[] = [
    { at: 0, type: 'phase', data: { phase: 'planning', label: 'Planning the architecture' } },
    { at: 1500, type: 'plan_ready', data: { requiresApproval: false, summary: `Plan for ${name}`, modules: [{ title: 'Data model' }, { title: 'API routes' }, { title: 'UI screens' }] } },
    { at: 2200, type: 'plan_completed' },
    { at: 2400, type: 'phase', data: { phase: 'generating', label: 'Writing code' } },
  ];
  files.forEach((path, i) => s.push({ at: 3000 + i * 650, type: 'file_checkpoint', data: { path, size: 400 + i * 137, content: `// ${path}\nexport const generated = true;\n` } }));
  const t = 3000 + files.length * 650;
  s.push(
    { at: t, type: 'module_complete', data: { module: 'ui' } },
    { at: t + 300, type: 'mystery_future_event', data: { note: 'unknown types are ignored' } },
    { at: t + 600, type: 'phase', data: { phase: 'verifying', label: 'Type-checking and validating' } },
    { at: t + 1400, type: 'typecheck_report', data: { errors: 3, files: 10 } },
    { at: t + 1800, type: 'healing_round', data: { round: 1, errorsBefore: 3, errorsAfter: 1 } },
    { at: t + 2800, type: 'healing_round', data: { round: 2, errorsBefore: 1, errorsAfter: 0 } },
    { at: t + 3200, type: 'healing_convergence', data: { converged: true, errorsAfter: 0 } },
    { at: t + 3600, type: 'validation_report', data: { passed: true, checks: 14 } },
    { at: t + 4000, type: 'preview_readiness', data: { ready: true } },
    { at: t + 4300, type: 'generation_quality_complete', data: { score: 92 } },
    { at: t + 4600, type: 'complete', data: { status: 'complete' } },
  );
  return s;
}

function chatScript(mode: string, proposalId: string) {
  const words = (mode === 'ask'
    ? 'The **streak** is stored on each `Habit` row and incremented when you check in on consecutive days.'
    : "I'll make the header sticky and add a dark-mode toggle. Here's a proposal for review."
  ).split(' ');
  const s: { at: number; type: string; data?: Record<string, unknown> }[] = [{ at: 0, type: 'turn' }];
  if (mode === 'agent') {
    s.push({ at: 300, type: 'agent_step', data: { label: 'Read components/Header.tsx' } }, { at: 800, type: 'agent_step', data: { label: 'Planned 2 edits' } });
  }
  words.forEach((w, i) => s.push({ at: 1000 + i * 90, type: 'delta', data: { text: `${w} ` } }));
  const end = 1000 + words.length * 90 + 200;
  if (mode !== 'ask') s.push({ at: end, type: 'proposal', data: { proposalId } });
  s.push({ at: end + 200, type: 'complete', data: { status: 'complete' } });
  return s;
}

function jobEvents(job: (typeof db.jobs)[number]): JobEvent[] {
  const elapsed = Date.now() - job.startedAt;
  if (job.status === 'cancelled') {
    return job.script.filter((e) => e.at <= (job.meta?.cancelledAt ? Number(job.meta.cancelledAt) : 0)).map((e, i) => ({ seq: i, type: e.type, data: e.data }))
      .concat([{ seq: 999, type: 'error', data: { message: 'Cancelled by you' } }]);
  }
  return job.script.filter((e) => e.at <= elapsed).map((e, i) => ({ seq: i, type: e.type, data: e.data }));
}

function settleJob(job: (typeof db.jobs)[number]) {
  const elapsed = Date.now() - job.startedAt;
  const last = job.script[job.script.length - 1]!;
  if (job.status === 'cancelled' || job.status === 'complete') return;
  if (elapsed >= last.at) {
    job.status = 'complete';
    job.finishedAt = now();
    if (job.kind === 'gen' && job.projectId && !db.projects.find((p) => p.id === job.projectId)) {
      db.projects.unshift({
        id: job.projectId,
        name: job.projectName ?? 'New app',
        description: job.meta?.prompt,
        stack: job.stack,
        kind: job.meta?.kind as Project['kind'],
        status: 'complete',
        ownerId: db.user.id,
        fileCount: 10,
        updatedAt: now(),
        createdAt: now(),
        previewReadiness: { ready: true },
        files: job.script.filter((e) => e.type === 'file_checkpoint').map((e) => ({ path: String(e.data!.path), content: String(e.data!.content), size: Number(e.data!.size) })),
      });
      db.checkpoints.set(job.projectId, [{ id: nid('c'), label: 'Initial generation', createdAt: now(), fileCount: 10 }]);
    }
    if (job.kind === 'chat' && job.meta?.conv) {
      const list = db.messages.get(job.meta.conv) ?? [];
      const text = job.script.filter((e) => e.type === 'delta').map((e) => String(e.data!.text)).join('').trim();
      const proposal = job.script.find((e) => e.type === 'proposal')?.data?.proposalId as string | undefined;
      list.push({ id: nid('m'), seq: list.length + 1, role: 'assistant', content: text, proposalId: proposal, createdAt: now() });
      db.messages.set(job.meta.conv, list);
    }
  } else {
    job.status = 'running';
  }
}

function deployStatus(d: (typeof db.deployments)[number]) {
  const e = Date.now() - d.startedAt;
  const labels = ['Build', 'Upload', 'Provision', 'Go live'];
  d.steps = labels.map((label, i) => ({ id: `s${i}`, label, status: e > (i + 1) * 3000 ? 'succeeded' : e > i * 3000 ? 'running' : 'pending', at: e > i * 3000 ? new Date(d.startedAt + i * 3000).toISOString() : undefined }));
  d.status = e > 12000 ? 'succeeded' : 'running';
  if (d.status === 'succeeded') d.url = 'https://habit-streaks.vercel.app';
  return d;
}

const ok = <T>(v: T) => v;
const fail = (status: number, msg: string): never => {
  throw new ApiError(status, msg);
};

type Handler = (m: RegExpMatchArray, body: Record<string, unknown>, opts: RequestOptions) => unknown;
const routes: [string, RegExp, Handler][] = [];
const on = (method: string, re: RegExp, h: Handler) => routes.push([method, re, h]);

// ── app config / health
on('GET', /^\/api\/health$/, () => ({ ok: true }));
on('GET', /^\/api\/platform\/app-config$/, () => ({
  minSupportedVersion: { ios: '1.0.0', android: '1.0.0' },
  latestVersion: '1.0.0',
  maintenance: { active: false },
  features: { editChat: true, mobileBuild: true, planApprovalGate: true, generationScope: true, wireframeGate: true, frontendPreview: true, conversationThread: true, elasticGenerationBudget: true },
}));

// ── auth
const session = () => {
  db.token = 'mock-token';
  return { token: 'mock-token', user: db.user };
};
on('POST', /^\/api\/platform\/auth\/login$/, (_m, b) => {
  if (!b.email || !b.password) fail(400, 'Email and password are required');
  if (String(b.password) === 'wrong') fail(401, 'Incorrect email or password');
  if (String(b.email).startsWith('2fa')) return { twoFactorRequired: true, tempToken: 'temp-2fa-token' };
  db.user = { ...db.user, email: String(b.email) };
  return session();
});
on('POST', /^\/api\/platform\/auth\/register$/, (_m, b) => {
  db.user = { ...db.user, email: String(b.email), name: String(b.name ?? ''), emailVerified: false, onboardingCompleted: false };
  return session();
});
on('POST', /^\/api\/platform\/auth\/2fa\/verify$/, (_m, b) => (b.code === '000000' ? fail(401, 'Invalid code') : session()));
on('POST', /^\/api\/platform\/auth\/(google|apple|oauth\/exchange)$/, () => session());
on('POST', /^\/api\/platform\/auth\/forgot-password$/, () => ({ sent: true }));
on('POST', /^\/api\/platform\/auth\/reset-password$/, () => ({ reset: true }));
on('POST', /^\/api\/platform\/auth\/verify-email$/, () => {
  db.user.emailVerified = true;
  return { verified: true };
});
on('POST', /^\/api\/platform\/auth\/resend-verification$/, () => ({ sent: true }));
on('GET', /^\/api\/platform\/auth\/me$/, () => (db.token ? db.user : fail(401, 'Not signed in')));
on('DELETE', /^\/api\/platform\/auth\/me$/, (_m, b) => {
  if (!b.password && !b.code) fail(400, 'Re-confirm with your password');
  db.token = null;
  return { deleted: true };
});
on('PATCH', /^\/api\/platform\/auth\/profile$/, (_m, b) => (db.user = { ...db.user, ...(b as Partial<User>) }));
on('POST', /^\/api\/platform\/auth\/change-password$/, (_m, b) => (b.currentPassword === 'wrong' ? fail(400, 'Current password is incorrect') : { changed: true }));
on('POST', /^\/api\/platform\/auth\/onboarding\/complete$/, (_m, b) => (db.user = { ...db.user, onboardingCompleted: true, defaultStack: (b.defaultStack as string) ?? db.user.defaultStack }));
on('POST', /^\/api\/platform\/auth\/2fa\/setup$/, () => ({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/IDEA:demo?secret=JBSWY3DPEHPK3PXP&issuer=IDEA' }));
on('POST', /^\/api\/platform\/auth\/2fa\/enable$/, () => {
  db.user.twoFactorEnabled = true;
  return { enabled: true, recoveryCodes: ['a1b2-c3d4', 'e5f6-g7h8', 'i9j0-k1l2'] };
});
on('POST', /^\/api\/platform\/auth\/2fa\/disable$/, () => {
  db.user.twoFactorEnabled = false;
  return { enabled: false };
});
on('POST', /^\/api\/platform\/auth\/api-keys$/, () => ({ saved: true }));
on('DELETE', /^\/api\/platform\/auth\/api-keys\/(.+)$/, () => ({ deleted: true }));
on('GET', /^\/api\/platform\/auth\/quota$/, () => ({ used: db.quotaUsed, limit: 10, resetsAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString() }));

// ── projects
on('GET', /^\/api\/platform\/projects$/, (_m, _b, o) => {
  const f = o.query?.filter;
  const list = f === 'team' ? db.projects.filter((p) => p.teamShared) : f === 'public' ? db.projects.filter((p) => p.isPublic) : db.projects;
  return list.map(({ files: _f, ...rest }) => rest);
});
on('GET', /^\/api\/platform\/projects\/templates$/, () => db.templates);
on('POST', /^\/api\/platform\/projects\/templates\/([^/]+)\/clone$/, (m) => {
  const t = db.templates.find((x) => x.id === m[1]) ?? fail(404, 'Template not found');
  const p: Project = { id: nid('p'), name: t.name, description: t.description, stack: t.stack, kind: t.kind, status: 'complete', ownerId: db.user.id, fileCount: 1, updatedAt: now(), createdAt: now(), files: [{ path: 'README.md', content: `# ${t.name}\n`, size: 20 }] };
  db.projects.unshift(p);
  return p;
});
on('GET', /^\/api\/platform\/projects\/([^/]+)$/, (m) => db.projects.find((p) => p.id === m[1]) ?? fail(404, 'Project not found'));
on('DELETE', /^\/api\/platform\/projects\/([^/]+)$/, (m) => {
  db.projects = db.projects.filter((p) => p.id !== m[1]);
  return { deleted: true };
});
on('PATCH', /^\/api\/platform\/projects\/([^/]+)\/(public|team-shared)$/, (m, b) => {
  const p = db.projects.find((x) => x.id === m[1]) ?? fail(404, 'Project not found');
  if (m[2] === 'public') p.isPublic = !!b.isPublic;
  else p.teamShared = !!b.teamShared;
  return p;
});
on('GET', /^\/api\/platform\/projects\/([^/]+)\/conversations$/, (m) => {
  const c = db.conversations.get(m[1]!);
  return c ? [c] : [];
});
on('POST', /^\/api\/platform\/projects\/([^/]+)\/conversations$/, (m) => {
  const c = { id: nid('conv'), projectId: m[1]! };
  db.conversations.set(m[1]!, c);
  db.messages.set(c.id, m[1] === 'p_habits'
    ? [
        { id: nid('m'), seq: 1, role: 'user', content: 'Add a streak counter to each habit', createdAt: ago(50) },
        { id: nid('m'), seq: 2, role: 'assistant', content: 'Done — each habit now shows a 🔥 **streak** that resets if you miss a day.', checkpointId: 'c2', createdAt: ago(42) },
      ]
    : []);
  return c;
});
on('GET', /^\/api\/platform\/projects\/([^/]+)\/conversations\/([^/]+)\/messages$/, (m, _b, o) => {
  const list = db.messages.get(m[2]!) ?? [];
  const before = o.query?.beforeSeq as number | undefined;
  const filtered = before ? list.filter((x) => x.seq < before) : list;
  return { messages: filtered.slice(-50), hasMore: filtered.length > 50 };
});
on('GET', /^\/api\/platform\/projects\/([^/]+)\/checkpoints$/, (m) => db.checkpoints.get(m[1]!) ?? []);
on('POST', /^\/api\/platform\/projects\/([^/]+)\/checkpoints\/([^/]+)\/restore$/, (m) => {
  const list = db.checkpoints.get(m[1]!) ?? [];
  const from = list.find((c) => c.id === m[2]);
  const c = { id: nid('c'), label: `Restored “${from?.label ?? m[2]}”`, createdAt: now(), fileCount: from?.fileCount };
  db.checkpoints.set(m[1]!, [...list, c]);
  return { checkpointId: c.id };
});

// ── AI
on('GET', /^\/api\/ai\/capabilities$/, () => ({
  stacks: [
    { id: 'nextjs', name: 'Next.js + Prisma', description: 'Full-stack React with a Postgres database.', kind: 'fullstack', status: 'ga', capabilities: ['SSR', 'Auth', 'Postgres', 'API routes'] },
    { id: 'react-vite', name: 'React + Vite', description: 'Fast single-page web apps.', kind: 'web', status: 'ga', capabilities: ['SPA', 'Tailwind'] },
    { id: 'expo', name: 'Expo (React Native)', description: 'iOS and Android apps.', kind: 'mobile', status: 'beta', capabilities: ['iOS', 'Android', 'Expo Router'] },
    { id: 'sveltekit', name: 'SvelteKit', description: 'Lean full-stack web apps.', kind: 'fullstack', status: 'experimental', capabilities: ['SSR'] },
  ],
}));
on('GET', /^\/api\/ai\/providers$/, () => [
  { id: 'anthropic', name: 'Anthropic', models: [{ id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', default: true }, { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' }] },
]);
on('POST', /^\/api\/ai\/estimate$/, (_m, b) => ({ tokens: 180_000 + ((b.requirements as unknown[])?.length ?? 0) * 12_000, minutes: 4 }));
on('POST', /^\/api\/ai\/requirements$/, () => ({
  projectName: 'My new app',
  requirements: [
    { id: 'r1', title: 'Users can sign up and sign in', priority: 'must' },
    { id: 'r2', title: 'Create, edit and delete items', priority: 'must' },
    { id: 'r3', title: 'Dashboard with a weekly chart', priority: 'should' },
    { id: 'r4', title: 'Daily reminder notifications', priority: 'could' },
  ],
}));
on('POST', /^\/api\/ai\/requirements\/suggest$/, () => ({ requirements: [{ id: nid('r'), title: 'Export data as CSV', priority: 'could' }, { id: nid('r'), title: 'Dark mode', priority: 'could' }] }));
on('POST', /^\/api\/ai\/wireframe$/, () => ({
  id: nid('wf'),
  screens: [
    { name: 'Sign in', description: 'Email + social sign-in', elements: ['Logo', 'Email', 'Password', 'Continue'] },
    { name: 'Dashboard', description: 'Today’s items and weekly chart', elements: ['Header', 'List', 'Chart', 'FAB'] },
    { name: 'Item detail', description: 'Edit an item', elements: ['Form', 'Save', 'Delete'] },
  ],
}));
on('POST', /^\/api\/ai\/generate\/v2$/, (_m, b) => {
  if (db.quotaUsed >= 10) fail(429, 'Daily limit reached');
  db.quotaUsed += 1;
  const name = (b.projectName as string) || 'New app';
  const job = { id: nid('job'), projectId: nid('p'), projectName: name, stack: String(b.stack), status: 'queued' as const, createdAt: now(), updatedAt: now(), script: genScript(name), startedAt: Date.now(), kind: 'gen' as const, meta: { prompt: String(b.prompt ?? ''), kind: b.stack === 'expo' ? 'mobile' : b.scope === 'website' ? 'web' : 'fullstack' } };
  db.jobs.unshift(job);
  return { jobId: job.id, streamUrl: `/api/ai/jobs/${job.id}/stream` };
});
on('POST', /^\/api\/ai\/chat\/v2$/, (_m, b) => {
  const conv = String(b.conversationId ?? '');
  const list = db.messages.get(conv) ?? [];
  list.push({ id: nid('m'), seq: list.length + 1, role: 'user', content: String(b.message), mode: b.mode as ChatMessage['mode'], createdAt: now() });
  db.messages.set(conv, list);
  const proposalId = nid('prop');
  db.proposals.set(proposalId, {
    id: proposalId,
    projectId: String(b.projectId),
    summary: 'Sticky header + dark-mode toggle',
    status: 'pending',
    files: [
      { path: 'components/Header.tsx', additions: 3, deletions: 1, status: 'modified', hunks: [{ header: '@@ -1,6 +1,8 @@', lines: [{ kind: 'context', text: 'export function Header() {' }, { kind: 'remove', text: '  return <header className="p-4">' }, { kind: 'add', text: '  return <header className="sticky top-0 z-10 p-4">' }, { kind: 'add', text: '    <ThemeToggle />' }, { kind: 'context', text: '  </header>;' }] }] },
      { path: 'components/ThemeToggle.tsx', additions: 6, deletions: 0, status: 'added', hunks: [{ header: '@@ -0,0 +1,6 @@', lines: [{ kind: 'add', text: "'use client';" }, { kind: 'add', text: 'export function ThemeToggle() {' }, { kind: 'add', text: '  return <button aria-label="Toggle theme">🌙</button>;' }, { kind: 'add', text: '}' }] }] },
    ],
  });
  const job = { id: nid('turn'), status: 'running' as const, createdAt: now(), script: chatScript(String(b.mode), proposalId), startedAt: Date.now(), kind: 'chat' as const, meta: { conv } };
  db.jobs.push(job);
  return { jobId: job.id };
});
on('GET', /^\/api\/ai\/edits\/([^/]+)$/, (m) => db.proposals.get(m[1]!) ?? fail(404, 'Proposal not found'));
on('POST', /^\/api\/ai\/edits\/([^/]+)\/(apply|discard)$/, (m) => {
  const p = db.proposals.get(m[1]!) ?? fail(404, 'Proposal not found');
  if (p.status !== 'pending') fail(409, 'Project changed since this suggestion');
  p.status = m[2] === 'apply' ? 'applied' : 'discarded';
  if (p.status === 'applied') {
    const list = db.checkpoints.get(p.projectId) ?? [];
    db.checkpoints.set(p.projectId, [...list, { id: nid('c'), label: p.summary, createdAt: now() }]);
  }
  return m[2] === 'apply' ? { applied: true } : { discarded: true };
});
on('POST', /^\/api\/ai\/explain$/, (_m, b) => ({ explanation: `### ${String(b.path)}\n\nThis file renders the main screen. It keeps a list of habits in React state and renders one row per habit.\n\n- \`useState\` holds the list\n- \`add()\` appends a new habit` }));
on('POST', /^\/api\/ai\/design-to-code$/, () => ({ prompt: 'Match the attached design: a card-based dashboard with a top bar and a floating add button.' }));
on('GET', /^\/api\/ai\/usage-stats$/, () => ({ generations: 23, tokens: 4_120_000, byDay: Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10), count: [0, 1, 3, 2, 0, 4, 1, 2, 2, 0, 3, 1, 2, 2][i]! })) }));

// ── jobs
on('GET', /^\/api\/ai\/jobs$/, () => {
  db.jobs.forEach(settleJob);
  const gens = db.jobs.filter((j) => j.kind === 'gen').map(({ script: _s, startedAt: _t, kind: _k, meta: _m, ...j }) => j);
  return [...gens, { id: 'job_old', projectId: 'p_habits', projectName: 'Habit Streaks', stack: 'Next.js + Prisma', status: 'complete', createdAt: ago(610), updatedAt: ago(600) }];
});
on('GET', /^\/api\/ai\/jobs\/([^/]+)$/, (m) => {
  const j = db.jobs.find((x) => x.id === m[1]);
  if (!j) return m[1] === 'job_old' ? { id: 'job_old', projectId: 'p_habits', projectName: 'Habit Streaks', status: 'complete', createdAt: ago(610), finishedAt: ago(600) } : fail(404, 'Job not found');
  settleJob(j);
  const { script: _s, startedAt: _t, kind: _k, meta: _m, ...rest } = j;
  return rest;
});
on('GET', /^\/api\/ai\/jobs\/([^/]+)\/events$/, (m, _b, o) => {
  const j = db.jobs.find((x) => x.id === m[1]);
  if (!j) return m[1] === 'job_old' ? [{ seq: 0, type: 'complete', data: { status: 'complete', projectId: 'p_habits' } }] : fail(404, 'Job not found');
  settleJob(j);
  const from = Number(o.query?.fromSeq ?? 0);
  return jobEvents(j)
    .map((e) => (e.type === 'complete' && j.projectId ? { ...e, data: { ...e.data, projectId: j.projectId } } : e))
    .filter((e) => e.seq >= from);
});
on('POST', /^\/api\/ai\/jobs\/([^/]+)\/cancel$/, (m) => {
  const j = db.jobs.find((x) => x.id === m[1]) ?? fail(404, 'Job not found');
  j.status = 'cancelled';
  j.meta = { ...j.meta, cancelledAt: String(Date.now() - j.startedAt) };
  return j;
});
on('POST', /^\/api\/ai\/jobs\/([^/]+)\/(retry|repair)$/, (m) => {
  const old = db.jobs.find((x) => x.id === m[1]);
  const job = { ...(old ?? { projectName: 'Retry', stack: 'nextjs', kind: 'gen' as const, meta: {} }), id: nid('job'), projectId: old?.projectId ?? nid('p'), status: 'queued' as const, createdAt: now(), startedAt: Date.now(), script: genScript(old?.projectName ?? 'Retry') };
  db.jobs.unshift(job as (typeof db.jobs)[number]);
  return { jobId: job.id };
});
on('POST', /^\/api\/ai\/jobs\/([^/]+)\/(finalize|approve-plan|adjust-plan)$/, (m) => db.jobs.find((x) => x.id === m[1]) ?? fail(404, 'Job not found'));

// ── preview
on('POST', /^\/api\/ai\/preview\/([^/]+)\/__control\/session-token$/, () => ({ token: 'preview', url: 'https://example.com/' }));
on('POST', /^\/api\/mobile\/projects\/([^/]+)\/preview$/, () => ({ id: nid('pv'), expoGoUrl: 'exp://u.expo.dev/demo', webUrl: 'https://example.com/', engine: 'expo-go', sdkVersion: '58.0.0' }));
on('GET', /^\/api\/mobile\/projects\/([^/]+)\/sdk$/, () => ({ current: '57.0.0', latest: '58.0.0', upgradeAvailable: true }));
on('POST', /^\/api\/mobile\/projects\/([^/]+)\/upgrade-sdk$/, () => ({ current: '58.0.0', latest: '58.0.0', upgradeAvailable: false }));
on('GET', /^\/api\/mobile\/projects\/([^/]+)\/readiness$/, () => ({ ready: true, checks: [{ id: 'icon', label: 'App icon', ok: true }, { id: 'pkg', label: 'Android package name', ok: true }, { id: 'sdk', label: 'Supported Expo SDK', ok: true }] }));
on('POST', /^\/api\/mobile\/projects\/([^/]+)\/repair$/, () => ({ ready: true, checks: [] }));
on('GET', /^\/api\/mobile\/projects\/([^/]+)\/builds$/, (m) =>
  db.builds.filter((b) => b.projectId === m[1]).map((b) => {
    const e = Date.now() - b.startedAt;
    b.status = e > 15000 ? 'succeeded' : e > 2000 ? 'building' : 'queued';
    if (b.status === 'succeeded') b.artifactUrl = 'https://example.com/app-release.apk';
    return b;
  }),
);
on('POST', /^\/api\/mobile\/projects\/([^/]+)\/builds$/, (m) => {
  const b = { id: nid('build'), projectId: m[1]!, status: 'queued' as const, createdAt: now(), startedAt: Date.now() };
  db.builds.unshift(b);
  return b;
});

// ── deploy
on('GET', /^\/api\/deploy\/providers$/, () => [
  { id: 'vercel', name: 'Vercel', connected: db.connections.some((c) => c.provider === 'vercel') || true },
  { id: 'railway', name: 'Railway', connected: db.connections.some((c) => c.provider === 'railway') },
  { id: 'github', name: 'GitHub', connected: db.connections.some((c) => c.provider === 'github') },
]);
on('POST', /^\/api\/deploy\/plan\/preview$/, (_m, b) => ({ id: nid('plan'), projectId: String(b.projectId), provider: String(b.provider), steps: [{ id: 'a', label: 'Install dependencies' }, { id: 'b', label: 'Build the app' }, { id: 'c', label: 'Provision database' }, { id: 'd', label: 'Go live' }] }));
on('POST', /^\/api\/deploy\/launch$/, () => {
  const d = { id: nid('dep'), projectId: 'p_habits', provider: 'vercel', status: 'running' as const, createdAt: now(), startedAt: Date.now() };
  db.deployments.unshift(d);
  return deployStatus(d);
});
on('GET', /^\/api\/deploy\/deployments\/([^/]+)$/, (m) => db.deployments.filter((d) => d.projectId === m[1] || m[1] !== 'p_habits').map(deployStatus));

// ── connections
on('GET', /^\/api\/platform\/connections\/capabilities$/, () => [
  { provider: 'github', name: 'GitHub', oauth: true, pat: true },
  { provider: 'vercel', name: 'Vercel', oauth: true, pat: true },
  { provider: 'railway', name: 'Railway', oauth: false, pat: true },
]);
on('GET', /^\/api\/platform\/connections$/, () => db.connections);
on('POST', /^\/api\/platform\/connections\/([^/]+)\/pat$/, (m) => {
  const c = { id: nid('conn'), provider: m[1]!, account: `${m[1]}-account`, createdAt: now() };
  db.connections.push(c);
  return c;
});
on('POST', /^\/api\/platform\/connections\/([^/]+)\/oauth\/start$/, () => fail(400, 'OAuth needs the live backend. Use a token in demo mode.'));
on('DELETE', /^\/api\/platform\/connections\/([^/]+)$/, (m) => {
  db.connections = db.connections.filter((c) => c.id !== m[1]);
  return { deleted: true };
});

// ── teams
on('GET', /^\/api\/platform\/teams\/my-team$/, () => db.team);
on('POST', /^\/api\/platform\/teams$/, (_m, b) => (db.team = { id: nid('team'), name: String(b.name), myRole: 'owner', members: [{ userId: db.user.id, name: db.user.name, email: db.user.email, role: 'owner' }], invites: [] }));
on('POST', /^\/api\/platform\/teams\/invite$/, (_m, b) => {
  const token = nid('inv') + 'xxxxxxxx';
  db.team?.invites?.push({ token, email: String(b.email), role: b.role as 'member', createdAt: now() });
  return { token };
});
on('POST', /^\/api\/platform\/teams\/accept-invite$/, () => db.team ?? (db.team = { id: 'team_x', name: 'Acme', myRole: 'member', members: [] }));
on('DELETE', /^\/api\/platform\/teams\/invites\/([^/]+)$/, (m) => {
  if (db.team) db.team.invites = db.team.invites?.filter((i) => i.token !== m[1]);
  return { revoked: true };
});
on('POST', /^\/api\/platform\/teams\/leave$/, () => ((db.team = null), { left: true }));
on('DELETE', /^\/api\/platform\/teams$/, () => ((db.team = null), { deleted: true }));

// ── db, notifications
on('GET', /^\/api\/db$/, () => [{ id: 'db1', name: 'habits-prod', engine: 'PostgreSQL', status: 'ok' }]);
on('POST', /^\/api\/db\/([^/]+)\/test$/, () => ({ ok: true, latencyMs: 42 }));
on('GET', /^\/api\/platform\/notifications\/preferences$/, () => db.prefs);
on('PATCH', /^\/api\/platform\/notifications\/preferences$/, (_m, b) => (db.prefs = { ...db.prefs, ...(b as Partial<NotificationPreferences>) }));
on('POST', /^\/api\/platform\/notifications\/devices$/, () => ({ registered: true }));
on('DELETE', /^\/api\/platform\/notifications\/devices\/(.+)$/, () => ({ removed: true }));

export function installMockBackend() {
  setTransport(async (path, opts) => {
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
    const method = opts.method ?? 'GET';
    const clean = path.split('?')[0]!;
    for (const [m, re, h] of routes) {
      if (m !== method) continue;
      const match = clean.match(re);
      if (match) return ok(h(match, (opts.body ?? {}) as Record<string, unknown>, opts));
    }
    throw new ApiError(404, `Demo backend has no route for ${method} ${clean}`);
  });
  if (__DEV__) console.log('[mock] demo backend installed');
}
