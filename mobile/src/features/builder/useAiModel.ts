import type { Provider } from '@/api/types';
import { useProviders } from '@/features/queries';
import { useDraft } from '@/stores/draft';
import { useSession } from '@/stores/session';

/**
 * Providers the backend runs on its own server-side key even though
 * `/ai/providers` labels them `requiresKey` (ai.service.ts `resolveApiKey`
 * falls back to the platform's env key for these).
 */
const SERVER_KEYED = new Set(['deepseek']);

/** Default provider, matching the web app's default (ai-generate.tsx). */
const PREFERRED_DEFAULT = 'deepseek';

/** Can this user run generations on this provider without adding a key? */
export function isUsableProvider(p: Provider, userKeys: string[]) {
  return !p.requiresKey || SERVER_KEYED.has(p.id) || userKeys.includes(p.id);
}

/**
 * The provider + model every builder step and the generation run on.
 *
 * Uses the draft's explicit choice when there is one; otherwise DeepSeek (the
 * platform default), falling back to the first usable provider. Returning
 * `undefined` lets the server fall back to its own default.
 */
export function useAiModel(): { provider?: string; model?: string } {
  const draft = useDraft((s) => s.draft);
  const providers = useProviders();
  // Select the stored array itself: a selector that builds a new array every
  // call makes zustand see a "change" on each render and loop forever.
  const apiKeys = useSession((s) => s.user?.apiKeys);
  const keys = apiKeys?.map((k) => k.provider) ?? [];
  if (draft.provider && draft.model) return { provider: draft.provider, model: draft.model };
  const usable = (providers.data ?? []).filter((p) => p.models.length && isUsableProvider(p, keys));
  const provider = usable.find((p) => p.id === PREFERRED_DEFAULT) ?? usable[0];
  const model = provider?.models.find((m) => m.default) ?? provider?.models[0];
  return provider && model ? { provider: provider.id, model: model.id } : {};
}
