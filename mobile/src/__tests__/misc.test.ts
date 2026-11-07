import { builderSteps, nextStep } from '@/features/builder/steps';
import { routeForPush } from '@/features/notifications/routes';
import { isAllowedUrl } from '@/features/preview/origins';
import { buildTreeRows, fuzzyScore } from '@/features/project/fileTree';
import { track, setAnalyticsSink } from '@/lib/analytics';
import { StorageKeys, storage } from '@/lib/storage';
import { compareVersions, isBelowMinimum } from '@/lib/version';
import { useDraft } from '@/stores/draft';


describe('draft persistence', () => {
  beforeEach(() => useDraft.getState().reset());

  it('writes every change to storage so a kill or 401 never loses the idea', () => {
    useDraft.getState().update({ prompt: 'A habit tracker' });
    const saved = storage.getJSON<{ prompt: string }>(StorageKeys.builderDraft);
    expect(saved?.prompt).toBe('A habit tracker');
  });

  it('never persists the attached image', () => {
    useDraft.getState().update({ prompt: 'x', designImage: 'data:image/png;base64,AAAA' });
    expect(storage.getJSON<{ designImage?: string }>(StorageKeys.builderDraft)?.designImage).toBeUndefined();
  });

  it('survives sign-out data clearing only when explicitly reset', () => {
    useDraft.getState().update({ prompt: 'keep me' });
    useDraft.getState().reset();
    expect(storage.getString(StorageKeys.builderDraft)).toBeUndefined();
  });
});

describe('versions / update gate', () => {
  it('compares semver', () => {
    expect(compareVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '2.0')).toBe(0);
    expect(isBelowMinimum('1.0.0', '1.0.1')).toBe(true);
    expect(isBelowMinimum('1.0.1', '1.0.1')).toBe(false);
    expect(isBelowMinimum('1.0.0', undefined)).toBe(false);
  });
});

describe('builder steps follow server flags', () => {
  it('skips scope and wireframe when the flags are off', () => {
    expect(builderSteps({ generationScope: false, wireframeGate: false })).toEqual(['idea', 'stack', 'requirements', 'review']);
    expect(nextStep('requirements', { generationScope: true, wireframeGate: true })).toBe('wireframe');
    expect(nextStep('review', { generationScope: true, wireframeGate: true })).toBeNull();
  });
});

describe('preview origin allow-list', () => {
  const origins = ['https://api.ideaplatform.app', 'https://*.preview.ideaplatform.app'];
  it('allows platform preview origins only', () => {
    expect(isAllowedUrl('https://api.ideaplatform.app/api/ai/preview/x', origins)).toBe(true);
    expect(isAllowedUrl('https://abc-123.preview.ideaplatform.app/', origins)).toBe(true);
    expect(isAllowedUrl('https://evil.com/', origins)).toBe(false);
    expect(isAllowedUrl('https://preview.ideaplatform.app.evil.com/', origins)).toBe(false);
    expect(isAllowedUrl('javascript:alert(1)', origins)).toBe(false);
  });
});

describe('push routing', () => {
  it('routes by payload ids only', () => {
    expect(routeForPush({ type: 'job_complete', jobId: 'j1' })).toBe('/job/j1');
    expect(routeForPush({ type: 'plan_ready', jobId: 'j1' })).toBe('/job/j1/plan');
    expect(routeForPush({ type: 'build_finished', projectId: 'p1' })).toBe('/project/p1/android-build');
    expect(routeForPush({ type: 'job_complete', jobId: '../x' })).toBeNull();
  });
});

describe('file tree', () => {
  const files = [{ path: 'src/b.ts' }, { path: 'src/a/x.ts' }, { path: 'README.md' }];
  it('lists folders first and expands on demand', () => {
    expect(buildTreeRows(files, new Set()).map((r) => r.path)).toEqual(['src', 'README.md']);
    expect(buildTreeRows(files, new Set(['src', 'src/a'])).map((r) => r.path)).toEqual(['src', 'src/a', 'src/a/x.ts', 'src/b.ts', 'README.md']);
  });
  it('fuzzy matches', () => {
    expect(fuzzyScore('sax', 'src/a/x.ts')).not.toBeNull();
    expect(fuzzyScore('zzz', 'src/a/x.ts')).toBeNull();
  });
});

describe('analytics privacy', () => {
  it('strips PII-like keys and tags the platform', () => {
    const sink = jest.fn();
    setAnalyticsSink(sink);
    track('generation_started', { stack: 'nextjs', prompt: 'secret idea', email: 'a@b.c' });
    expect(sink).toHaveBeenCalledWith('generation_started', expect.objectContaining({ stack: 'nextjs', platform: expect.any(String) }));
    const params = sink.mock.calls[0][1];
    expect(params.prompt).toBeUndefined();
    expect(params.email).toBeUndefined();
    setAnalyticsSink(null);
  });
});
