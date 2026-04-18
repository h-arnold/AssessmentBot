import { renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import type { StartupWarmupDatasetKey } from '../../query/sharedQueries';
import {
  StartupWarmupStateProvider,
  useStartupWarmupState,
  type StartupWarmupStatus,
} from './startupWarmupState';

/**
 * Renders the warm-up state provider with scalar warm-up status.
 *
 * @param {StartupWarmupStatus} warmupState Warm-up state to expose.
 * @returns {ReturnType<typeof renderHook>} Hook render result.
 */
function renderWarmupState(warmupState: StartupWarmupStatus) {
  return renderHook(() => useStartupWarmupState(), {
    wrapper: createWarmupStateWrapper(warmupState),
  });
}

/**
 * Creates a provider wrapper for scalar warm-up state tests.
 *
 * @param {StartupWarmupStatus} warmupState Warm-up state to expose.
 * @returns {(properties: Readonly<PropsWithChildren>) => JSX.Element} Provider wrapper.
 */
function createWarmupStateWrapper(warmupState: StartupWarmupStatus) {
  return function WarmupStateWrapper({ children }: Readonly<PropsWithChildren>) {
    return <StartupWarmupStateProvider warmupState={warmupState}>{children}</StartupWarmupStateProvider>;
  };
}

describe('StartupWarmupStateProvider', () => {
  it('throws when useStartupWarmupState is called outside the provider', () => {
    expect(() => renderHook(() => useStartupWarmupState())).toThrow(
      'useStartupWarmupState must be used within StartupWarmupStateProvider.'
    );
  });

  it('provides warmupState: loading', () => {
    const { result } = renderWarmupState('loading');

    expect(result.current).toMatchObject({
      warmupState: 'loading',
      isLoading: true,
      isReady: false,
      isFailed: false,
    });
  });

  it('provides warmupState: ready', () => {
    const { result } = renderWarmupState('ready');

    expect(result.current).toMatchObject({
      warmupState: 'ready',
      isLoading: false,
      isReady: true,
      isFailed: false,
    });
  });

  it('provides warmupState: failed', () => {
    const { result } = renderWarmupState('failed');

    expect(result.current).toMatchObject({
      warmupState: 'failed',
      isLoading: false,
      isReady: false,
      isFailed: true,
    });
  });

  it('exposes dataset snapshot status and trustworthiness through the hook contract', () => {
    const datasetKey: StartupWarmupDatasetKey = 'assignmentDefinitionPartials';
    const { result } = renderWarmupState('ready');

    expect(result.current.snapshot.datasets[datasetKey]).toMatchObject({
      status: 'ready',
      isTrustworthy: true,
    });
  });

  it('exposes dataset helper semantics through isDatasetReady and isDatasetFailed', () => {
    const datasetKey: StartupWarmupDatasetKey = 'assignmentDefinitionPartials';
    const { result } = renderWarmupState('failed');

    expect(result.current.isDatasetReady(datasetKey)).toBe(false);
    expect(result.current.isDatasetFailed(datasetKey)).toBe(true);
  });

  it('does not require dataset errorCode or requestId fields for hook consumers', () => {
    const datasetKey: StartupWarmupDatasetKey = 'assignmentDefinitionPartials';
    const { result } = renderWarmupState('failed');
    const datasetSnapshot = result.current.snapshot.datasets[datasetKey] as {
      errorCode?: string;
      requestId?: string;
    };

    expect(datasetSnapshot.errorCode).toBeUndefined();
    expect(datasetSnapshot.requestId).toBeUndefined();
  });
});
