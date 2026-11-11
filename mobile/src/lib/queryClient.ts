import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';

import { StorageKeys, storage } from './storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (count, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 429)) {
          return false;
        }
        return count < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: false, // mutations only retry when they carry an idempotency key, handled per call
    },
  },
});

/** Only these roots are persisted to MMKV so the app opens instantly offline (§8.2). */
/**
 * Bump when the shape of cached query data changes (e.g. an API adapter now
 * returns a different structure). The persisted cache is keyed on it, so data
 * saved in the old shape is discarded instead of being rendered by new code.
 *  2 — backend payloads are normalised through api/adapters.ts.
 */
export const CACHE_SCHEMA_VERSION = 2;

export const PERSISTED_ROOTS = new Set(['me', 'projects', 'templates', 'project', 'app-config']);
const MAX_PERSISTED_PROJECT_DETAILS = 5;

export const queryPersister = createSyncStoragePersister({
  key: StorageKeys.queryCache,
  storage: {
    getItem: (k) => storage.getString(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.remove(k),
  },
  throttleTime: 2000,
});

export function shouldPersistQuery(query: { queryKey: readonly unknown[]; state: { status: string; dataUpdatedAt: number } }) {
  const root = query.queryKey[0];
  if (typeof root !== 'string' || !PERSISTED_ROOTS.has(root) || query.state.status !== 'success') return false;
  if (root !== 'project') return true;
  // Never persist file contents for more than the 5 most recent projects.
  const recent = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['project'] })
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MAX_PERSISTED_PROJECT_DETAILS)
    .map((q) => q.queryHash);
  return recent.includes(JSON.stringify(query.queryKey));
}
