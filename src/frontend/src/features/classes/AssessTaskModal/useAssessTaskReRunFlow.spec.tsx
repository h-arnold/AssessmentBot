import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useAssessTaskReRunFlow, type AssessTaskReRunHost } from './useAssessTaskReRunFlow';

vi.mock('./assessTaskFlowData', () => {
  return {
    resolveReRunTarget: vi.fn(function resolveReRunTarget() {
      return {
        kind: 'blocked',
        retryable: false,
        alertType: 'warning',
        message: 'No linked definition.',
      };
    }),
  };
});

const SECOND_PROCESSED_CONTEXT_COUNT = 2;

/**
 * Creates the minimal flow controls needed by a blocked re-run context.
 *
 * @param {ReturnType<typeof vi.fn>} setAssessmentAsError The blocked-state recorder.
 * @returns {AssessTaskReRunHost['flow']} The test flow controls.
 */
function createBlockedFlow(setAssessmentAsError: ReturnType<typeof vi.fn>) {
  return {
    assignments: [],
    fetchState: 'ready',
    assessmentState: 'idle',
    sessionReference: { current: 1 },
    captureStartContext: vi.fn(),
    isAttemptObsolete: vi.fn(() => false),
    handleStartAssessmentError: vi.fn(),
    setAssessmentAsError,
    setAssessmentState: vi.fn(),
    setAssessmentError: vi.fn(),
    settleAssessment: vi.fn(),
  } as unknown as AssessTaskReRunHost['flow'];
}

/**
 * Creates a Query Client provider wrapper for the hook's context.
 *
 * @returns {({ children }: PropsWithChildren) => ReactElement} The hook wrapper.
 */
function createWrapper() {
  const queryClient = new QueryClient();
  return function Wrapper({ children }: PropsWithChildren): ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAssessTaskReRunFlow context identity', () => {
  it('treats null and empty definition keys as the same processed context', () => {
    const setAssessmentAsError = vi.fn();
    const flow = createBlockedFlow(setAssessmentAsError);

    const { rerender } = renderHook(
      ({ definitionKey }: { definitionKey: string | null }) => {
        return useAssessTaskReRunFlow({
          open: true,
          classId: 'class-1',
          reRunContext: { assignmentId: 'assignment-1', definitionKey },
          flow,
        });
      },
      { initialProps: { definitionKey: null as string | null }, wrapper: createWrapper() }
    );

    expect(setAssessmentAsError).toHaveBeenCalledTimes(1);
    rerender({ definitionKey: '' });
    expect(setAssessmentAsError).toHaveBeenCalledTimes(1);
  });

  it('keeps the literal null key distinct from a null definition key', () => {
    const setAssessmentAsError = vi.fn();
    const flow = createBlockedFlow(setAssessmentAsError);

    const { rerender } = renderHook(
      ({ definitionKey }: { definitionKey: string | null }) => {
        return useAssessTaskReRunFlow({
          open: true,
          classId: 'class-1',
          reRunContext: { assignmentId: 'assignment-1', definitionKey },
          flow,
        });
      },
      { initialProps: { definitionKey: null as string | null }, wrapper: createWrapper() }
    );

    expect(setAssessmentAsError).toHaveBeenCalledTimes(1);
    rerender({ definitionKey: 'null' });
    expect(setAssessmentAsError).toHaveBeenCalledTimes(SECOND_PROCESSED_CONTEXT_COUNT);
  });
});
