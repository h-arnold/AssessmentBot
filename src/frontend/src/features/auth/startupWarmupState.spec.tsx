import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  StartupWarmupStateProvider,
  useStartupWarmupState,
  type StartupWarmupStatus,
} from './startupWarmupState';

/**
 * Probes the warm-up state hook for assertions.
 *
 * @returns {JSX.Element} Serialised warm-up state.
 */
function StartupWarmupProbe() {
  return <output data-testid="startup-warmup-probe">{JSON.stringify(useStartupWarmupState())}</output>;
}

/**
 * Renders the warm-up state provider with a probe child.
 *
 * @param {StartupWarmupStatus} warmupState Warm-up state to expose.
 * @returns {void} Nothing.
 */
function renderWarmupState(warmupState: StartupWarmupStatus) {
  render(
    <StartupWarmupStateProvider warmupState={warmupState}>
      <StartupWarmupProbe />
    </StartupWarmupStateProvider>
  );
}

describe('StartupWarmupStateProvider', () => {
  it('provides warmupState: loading', () => {
    renderWarmupState('loading');

    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'loading',
        isLoading: true,
        isReady: false,
        isFailed: false,
      })
    );
  });

  it('provides warmupState: ready', () => {
    renderWarmupState('ready');

    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'ready',
        isLoading: false,
        isReady: true,
        isFailed: false,
      })
    );
  });

  it('provides warmupState: failed', () => {
    renderWarmupState('failed');

    expect(screen.getByTestId('startup-warmup-probe')).toHaveTextContent(
      JSON.stringify({
        warmupState: 'failed',
        isLoading: false,
        isReady: false,
        isFailed: true,
      })
    );
  });
});
