/**
 * API types copied from the backend's zod schemas (§3 "Shared types", v1).
 * `npm run check:api-types` (CI) diffs these against the backend once the
 * monorepo is wired. Fields the client doesn't need are typed loosely so
 * additive server changes never break parsing.
 */

export type Envelope<T> = { success: boolean; data: T | null; error: string | null; code?: string };

// ── Auth ──────────────────────────────────────────────────────────────
export type User = {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  twoFactorEnabled?: boolean;
  onboardingCompleted?: boolean;
  defaultStack?: string;
  plan?: string;
  apiKeys?: { provider: string; last4?: string; createdAt?: string }[];
  createdAt?: string;
};

export type AuthSession = { token: string; user: User };
export type LoginResult = AuthSession | { twoFactorRequired: true; tempToken: string };

export type Quota = {
  used: number;
  limit: number | null; // null → unlimited
  resetsAt?: string;
  unlimited?: boolean;
};

// ── App config (§6.6) ────────────────────────────────────────────────
export type FeatureFlags = {
  editChat: boolean;
  mobileBuild: boolean;
  planApprovalGate: boolean;
  generationScope: boolean;
  wireframeGate: boolean;
  frontendPreview: boolean;
  conversationThread: boolean;
  elasticGenerationBudget?: boolean;
};

export type AppConfig = {
  minSupportedVersion: { ios: string; android: string };
  latestVersion?: string;
  maintenance: { active: boolean; message?: string };
  features: FeatureFlags;
};

// ── Projects ─────────────────────────────────────────────────────────
export type ProjectStatus = 'draft' | 'generating' | 'complete' | 'partial' | 'failed';
export type ProjectKind = 'web' | 'mobile' | 'fullstack';

export type ProjectFile = { path: string; content: string; size?: number };

export type ProjectSummary = {
  id: string;
  name: string;
  description?: string;
  stack?: string;
  kind?: ProjectKind;
  status?: ProjectStatus;
  isPublic?: boolean;
  teamShared?: boolean;
  ownerId?: string;
  fileCount?: number;
  updatedAt?: string;
  createdAt?: string;
  lastJobId?: string;
};

export type Project = ProjectSummary & {
  files?: ProjectFile[];
  previewUrl?: string;
  previewReadiness?: { ready: boolean; reasons?: string[] };
};

export type Template = {
  id: string;
  name: string;
  description?: string;
  stack?: string;
  kind?: ProjectKind;
  tags?: string[];
  examplePrompt?: string;
  thumbnailUrl?: string;
};

// ── Conversations ────────────────────────────────────────────────────
export type Conversation = { id: string; projectId: string; title?: string; createdAt?: string };
export type MessageRole = 'user' | 'assistant' | 'system';
export type ChatMessage = {
  id: string;
  seq: number;
  role: MessageRole;
  content: string;
  mode?: ChatMode;
  checkpointId?: string;
  proposalId?: string;
  createdAt?: string;
};
export type ChatMode = 'ask' | 'edit' | 'agent' | 'chat' | 'refine';
export type Checkpoint = { id: string; label?: string; createdAt?: string; fileCount?: number };

// ── AI ───────────────────────────────────────────────────────────────
export type StackStatus = 'ga' | 'beta' | 'experimental';
export type Stack = {
  id: string;
  name: string;
  description?: string;
  kind: ProjectKind;
  status: StackStatus;
  capabilities?: string[];
};
/** `requiresKey`: the user must add their own API key (otherwise the platform's key is used). */
export type Provider = { id: string; name: string; requiresKey?: boolean; models: { id: string; name: string; default?: boolean }[] };
export type Capabilities = { stacks: Stack[] };

export type Requirement = { id: string; title: string; detail?: string; priority?: 'must' | 'should' | 'could' };
/** `raw` is the server's wireframe spec, sent back with the generate request once approved. */
export type Wireframe = { id: string; screens: { name: string; description: string; elements?: string[] }[]; raw?: unknown };
/** `minutes` is only set when the server provides one; `risk`/`mode` come from the token-budget planner. */
export type Estimate = { tokens: number; minutes?: number; risk?: string; mode?: string; cost?: number; quotaCost?: number };

// Requirements interview (POST /api/ai/requirements → /requirements/compile)
export type QuestionCategory = 'features' | 'design' | 'users' | 'technical' | 'scope' | string;
export type RequirementsQuestion = { id: string; question: string; hint?: string; category: QuestionCategory; required: boolean };
export type RequirementsAnswer = { questionId: string; question: string; answer: string; required?: boolean };
export type QuestionsResult = { appType?: string; projectName?: string; questions: RequirementsQuestion[] };
/** Compiled requirements document. Typed loosely: it round-trips to the server unchanged. */
export type RequirementsDocument = {
  originalPrompt: string;
  projectName: string;
  appType?: string;
  coreFeatures?: string[];
  compiledSummary?: string;
  answers?: RequirementsAnswer[];
  approvedWireframe?: unknown;
  [key: string]: unknown;
};

export type GenerationScope = 'website' | 'fullApp';

export type GenerateRequest = {
  prompt: string;
  stack: string;
  scope?: GenerationScope;
  model?: string;
  requirements?: Requirement[];
  wireframeId?: string;
  projectName?: string;
  designImage?: string;
};
export type GenerateAccepted = { jobId: string; projectId?: string; guestToken?: string; streamUrl?: string };

// ── Jobs ─────────────────────────────────────────────────────────────
export type JobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_plan_approval'
  | 'complete'
  | 'partial'
  | 'failed'
  | 'cancelled';

export type Job = {
  id: string;
  projectId?: string;
  projectName?: string;
  stack?: string;
  status: JobStatus;
  phase?: string;
  progress?: number;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  lastSeq?: number;
};

export type JobEvent = { seq: number; type: string; data?: Record<string, unknown>; ts?: string };

// ── Edit chat ────────────────────────────────────────────────────────
export type DiffHunk = { header: string; lines: { kind: 'add' | 'remove' | 'context'; text: string }[] };
export type FileDiff = { path: string; additions: number; deletions: number; hunks: DiffHunk[]; status?: 'added' | 'modified' | 'deleted' };
export type EditProposal = {
  id: string;
  projectId: string;
  summary?: string;
  status: 'pending' | 'applied' | 'discarded' | 'stale';
  files: FileDiff[];
};

// ── Preview ──────────────────────────────────────────────────────────
export type MobilePreview = {
  id: string;
  manifestUrl?: string;
  expoGoUrl?: string;
  webUrl?: string;
  engine?: 'expo-go' | 'snack';
  sdkVersion?: string;
};

// ── Mobile builds ────────────────────────────────────────────────────
export type BuildStatus = 'queued' | 'building' | 'succeeded' | 'failed' | 'cancelled';
export type MobileBuild = {
  id: string;
  projectId: string;
  status: BuildStatus;
  artifactUrl?: string;
  createdAt?: string;
  finishedAt?: string;
  logsUrl?: string;
  error?: string;
};
export type Readiness = { ready: boolean; checks: { id: string; label: string; ok: boolean; detail?: string }[] };
export type SdkInfo = { current: string; latest: string; upgradeAvailable: boolean };

// ── Deploy ───────────────────────────────────────────────────────────
export type DeployProvider = { id: 'vercel' | 'railway' | 'github' | string; name: string; connected: boolean };
export type DeployPlan = {
  id: string;
  projectId: string;
  provider: string;
  steps: { id: string; label: string; status?: TimelineStatus }[];
  status?: TimelineStatus;
};
export type TimelineStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type Deployment = {
  id: string;
  projectId: string;
  provider: string;
  status: TimelineStatus;
  url?: string;
  createdAt?: string;
  steps?: { id: string; label: string; status: TimelineStatus; at?: string }[];
};

// ── Connections / teams / db ─────────────────────────────────────────
export type Connection = { id: string; provider: string; account?: string; createdAt?: string };
export type ConnectionCapability = { provider: string; name: string; oauth: boolean; pat: boolean };

export type TeamRole = 'owner' | 'admin' | 'member';
export type TeamMember = { userId: string; name?: string; email: string; role: TeamRole };
export type TeamInvite = { token: string; email: string; role: TeamRole; createdAt?: string };
export type Team = { id: string; name: string; members: TeamMember[]; invites?: TeamInvite[]; myRole: TeamRole };

export type DbConnection = { id: string; name: string; engine: string; status?: 'ok' | 'error' | 'unknown' };

// ── Notifications (§6.5) ─────────────────────────────────────────────
export type NotificationPreferences = {
  generation: boolean;
  planReady: boolean;
  builds: boolean;
  deploys: boolean;
  teamInvites: boolean;
};

export type UsageStats = { generations: number; tokens: number; byDay?: { date: string; count: number }[] };
