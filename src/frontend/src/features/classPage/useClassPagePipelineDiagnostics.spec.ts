import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { useClassPagePipelineDiagnostics } from './useClassPagePipelineDiagnostics';

const CLASS_ID = 'class-abc-123';
const ADAPTER_LOG_ARGUMENT_COUNT = 3;
const ADAPTER_LOG_REQUIRED_ARGUMENT_COUNT = 2;
const DISTINCT_ERROR_COUNT_TO_TRIGGER_EVICTION = 257;
const EXPECTED_LOG_COUNT_AFTER_RE_EMISSION = 258;

const { mockLogFrontendError } = vi.hoisted(() => ({
  mockLogFrontendError: vi.fn(),
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: mockLogFrontendError,
}));

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Render hook callbacks beneath React StrictMode.
 *
 * @param {{ children: ReactNode }} properties - Wrapper children.
 * @returns {ReactNode} The StrictMode subtree.
 */
function StrictModeWrapper({ children }: { children: ReactNode }) {
  return createElement(StrictMode, null, children);
}

/**
 * Assert the most recent adapter diagnostic call and its empty metadata slot.
 *
 * @param {Error} error - The adapter error expected in the log call.
 */
function expectLatestAdapterDiagnostic(error: Error): void {
  const latestCall = mockLogFrontendError.mock.lastCall;
  expect(latestCall).toHaveLength(ADAPTER_LOG_ARGUMENT_COUNT);
  expect(latestCall?.slice(0, ADAPTER_LOG_REQUIRED_ARGUMENT_COUNT)).toEqual([
    'useClassPageData.runAdapterStep',
    error,
  ]);
  expect(latestCall?.[2]).toBeUndefined();
}

describe('useClassPagePipelineDiagnostics', () => {
  it('logs an adapter error once across the StrictMode effect rerun', () => {
    const adapterError = new TypeError('adapter failed');
    const { rerender } = renderHook(
      () => useClassPagePipelineDiagnostics(CLASS_ID, null, adapterError),
      { wrapper: StrictModeWrapper }
    );

    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
    expectLatestAdapterDiagnostic(adapterError);

    rerender();

    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
  });

  it('suppresses a distinct error instance with the same diagnostic key', () => {
    const firstError = new TypeError('adapter failed');
    const duplicateKeyError = new TypeError('adapter failed');
    expect(firstError).not.toBe(duplicateKeyError);
    const { rerender } = renderHook(
      ({ adapterError }: { adapterError: Error }) =>
        useClassPagePipelineDiagnostics(CLASS_ID, null, adapterError),
      { initialProps: { adapterError: firstError } }
    );

    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
    expectLatestAdapterDiagnostic(firstError);

    rerender({ adapterError: duplicateKeyError });

    expect(mockLogFrontendError).toHaveBeenCalledTimes(1);
    expectLatestAdapterDiagnostic(firstError);
  });

  it('evicts the oldest retained key and re-emits that error after the cap is exceeded', () => {
    const firstError = new Error('adapter-error-0');
    const { rerender } = renderHook(
      ({ adapterError }: { adapterError: Error }) =>
        useClassPagePipelineDiagnostics(CLASS_ID, null, adapterError),
      { initialProps: { adapterError: firstError } }
    );

    for (let index = 1; index < DISTINCT_ERROR_COUNT_TO_TRIGGER_EVICTION; index++) {
      rerender({ adapterError: new Error(`adapter-error-${index}`) });
    }

    expect(mockLogFrontendError).toHaveBeenCalledTimes(DISTINCT_ERROR_COUNT_TO_TRIGGER_EVICTION);

    rerender({ adapterError: firstError });

    expect(mockLogFrontendError).toHaveBeenCalledTimes(EXPECTED_LOG_COUNT_AFTER_RE_EMISSION);
    expectLatestAdapterDiagnostic(firstError);
  });
});
