export type BuilderStep = 'idea' | 'scope' | 'stack' | 'requirements' | 'wireframe' | 'review';

export function builderSteps(flags: { generationScope: boolean; wireframeGate: boolean }): BuilderStep[] {
  return ['idea', ...(flags.generationScope ? (['scope'] as const) : []), 'stack', 'requirements', ...(flags.wireframeGate ? (['wireframe'] as const) : []), 'review'];
}

export function nextStep(current: BuilderStep, flags: { generationScope: boolean; wireframeGate: boolean }): BuilderStep | null {
  const steps = builderSteps(flags);
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? (steps[i + 1] as BuilderStep) : null;
}

export function stepProgress(current: BuilderStep, flags: { generationScope: boolean; wireframeGate: boolean }) {
  const steps = builderSteps(flags);
  return { index: steps.indexOf(current) + 1, total: steps.length };
}
