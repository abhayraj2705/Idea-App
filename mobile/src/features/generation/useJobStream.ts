import * as Network from 'expo-network';
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

import type { JobEvent } from '@/api/types';
import { haptics } from '@/lib/haptics';
import { setSentryTag } from '@/lib/sentry';

import { STAGE_LABEL, applyEvents, initialGenerationState, isTerminal, type GenerationState } from './eventReducer';
import { JobStream, type StreamMode } from './jobStream';

/** State is keyed by jobId so switching jobs (e.g. a new chat turn) always starts clean. */
type Keyed = { jobId: string | undefined; s: GenerationState };
type Action = { type: 'events'; jobId: string; events: JobEvent[] } | { type: 'reset'; jobId: string | undefined };

function reducer(state: Keyed, action: Action): Keyed {
  if (action.type === 'reset') return { jobId: action.jobId, s: initialGenerationState };
  const base = state.jobId === action.jobId ? state.s : initialGenerationState;
  return { jobId: action.jobId, s: applyEvents(base, action.events) };
}

export function useJobStream(jobId: string | undefined, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled !== false && !!jobId;
  const [keyed, dispatch] = useReducer(reducer, { jobId, s: initialGenerationState });
  const state = keyed.jobId === jobId ? keyed.s : initialGenerationState;
  const [mode, setMode] = useState<StreamMode>('idle');
  const stateRef = useRef(state);
  const streamRef = useRef<JobStream | null>(null);

  // Keep the ref the stream reads (lastSeq / terminal) in sync after each commit.
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (!enabled || !jobId) return;
    stateRef.current = initialGenerationState;
    setSentryTag('jobId', jobId);
    const stream = new JobStream(jobId, {
      onEvents: (events) => {
        // Apply to the ref immediately so back-to-back batches see the new lastSeq.
        stateRef.current = applyEvents(stateRef.current, events);
        dispatch({ type: 'events', jobId, events });
      },
      onModeChange: setMode,
      isTerminal: () => isTerminal(stateRef.current),
      getLastSeq: () => stateRef.current.lastSeq,
    });
    streamRef.current = stream;
    stream.start();

    // Background → close the socket and rely on push. Foreground → reattach with fromSeq.
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') stream.start();
      else if (s === 'background') stream.stop();
    });
    let wasConnected = true;
    const netSub = Network.addNetworkStateListener((ns) => {
      const connected = !!ns.isConnected;
      if (connected && !wasConnected) stream.kick();
      wasConnected = connected;
    });

    return () => {
      stream.stop();
      appSub.remove();
      netSub.remove();
      streamRef.current = null;
      setSentryTag('jobId', null);
    };
  }, [enabled, jobId]);

  // Accessibility announcements + haptics on stage / end changes.
  const prev = useRef<{ stage: string; end?: string }>({ stage: state.stage, end: state.endStatus });
  useEffect(() => {
    if (state.stage !== prev.current.stage) {
      prev.current.stage = state.stage;
      AccessibilityInfo.announceForAccessibility(`Stage: ${STAGE_LABEL[state.stage]}`);
    }
    if (state.endStatus && state.endStatus !== prev.current.end) {
      prev.current.end = state.endStatus;
      if (state.endStatus === 'complete') {
        haptics.success();
        AccessibilityInfo.announceForAccessibility('Your app is ready');
      } else {
        haptics.error();
        AccessibilityInfo.announceForAccessibility(state.endStatus === 'partial' ? 'Generation finished with issues' : 'Generation failed');
      }
    }
  }, [state.stage, state.endStatus]);

  const restart = useCallback(() => {
    dispatch({ type: 'reset', jobId });
    stateRef.current = initialGenerationState;
    streamRef.current?.stop();
    streamRef.current?.start();
  }, [jobId]);

  return { state, mode, restart };
}
