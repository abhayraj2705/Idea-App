import { create } from 'zustand';

import type { GenerationScope, Requirement, Wireframe } from '@/api/types';
import { StorageKeys, storage } from '@/lib/storage';

/**
 * Builder draft (§7.2). Every change is written to MMKV synchronously so an
 * OS kill or a 401 never loses a typed idea.
 */
export type BuilderDraft = {
  prompt: string;
  projectName?: string;
  scope: GenerationScope;
  stack?: string;
  model?: string;
  requirements: Requirement[];
  wireframe?: Wireframe;
  wireframeApproved: boolean;
  designImage?: string; // base64 data URL, cleared after use
  updatedAt?: string;
};

export const emptyDraft: BuilderDraft = {
  prompt: '',
  scope: 'fullApp',
  requirements: [],
  wireframeApproved: false,
};

type DraftState = {
  draft: BuilderDraft;
  update: (patch: Partial<BuilderDraft>) => void;
  reset: () => void;
  hasContent: () => boolean;
};

function load(): BuilderDraft {
  const saved = storage.getJSON<BuilderDraft>(StorageKeys.builderDraft);
  return saved ? { ...emptyDraft, ...saved, designImage: undefined } : emptyDraft;
}

export const useDraft = create<DraftState>((set, get) => ({
  draft: load(),
  update: (patch) => {
    const draft = { ...get().draft, ...patch, updatedAt: new Date().toISOString() };
    // Large images are not persisted (storage budget); the text is.
    storage.setJSON(StorageKeys.builderDraft, { ...draft, designImage: undefined });
    set({ draft });
  },
  reset: () => {
    storage.remove(StorageKeys.builderDraft);
    set({ draft: emptyDraft });
  },
  hasContent: () => get().draft.prompt.trim().length > 0,
}));
