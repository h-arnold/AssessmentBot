/**
 * Recovery settlement, safe diagnostics and user-safe error mapping.
 *
 * Hook-level flows use deferred promises for the cancellation races; the
 * assessment mapping case drives the owning modal because the message renders
 * there.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import {
  getAssignmentDefinition,
  upsertAssignmentDefinition,
} from '../../../services/assignmentDefinition/assignmentDefinitionService';
import type { AssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import type { AssignmentDefinitionPartial } from '../../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { queryKeys } from '../../../query/queryKeys';
import { createAppQueryClient } from '../../../query/queryClient';
import { createFixtureClassPartial } from '../../../test/classes/classesPageTestHelpers';
import {
  clickStartAssessment,
  MOCK_CLASS_ID,
  selectAssignment,
} from '../../../test/classes/AssessTaskModal.test-utilities';
import {
  queueStartResults,
  RECOVERY_DEFINITION,
  RECOVERY_DEFINITION_KEY,
  renderRecoveryModal,
} from '../../../test/classes/AssessTaskModal.recovery-helpers';
import { useAssessTaskLinkFlow } from './useAssessTaskLinkFlow';
import { useAssessTaskRecoveryFlow } from './useAssessTaskRecoveryFlow';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: vi.fn(),
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: vi.fn(),
}));

vi.mock('../../../services/referenceData/referenceDataService', () => ({
  getCohorts: vi.fn(),
  getYearGroups: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Creates a fresh query client and a provider wrapper for hook tests.
 *
 * @returns {object} The query client and wrapper component.
 */
function createHookWrapper(): {
  queryClient: ReturnType<typeof createAppQueryClient>;
  wrapper: ({ children }: { children: ReactNode }) => ReactNode;
} {
  const queryClient = createAppQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

/**
 * Builds default recovery properties with fresh callback spies.
 *
 * @param {object} overrides - Property overrides for the test.
 * @returns {object} Recovery properties and their spies.
 */
function recoveryProperties(overrides: Record<string, unknown> = {}): {
  properties: Parameters<typeof useAssessTaskRecoveryFlow>[0];
  settleAssessment: ReturnType<typeof vi.fn>;
  endRecovery: ReturnType<typeof vi.fn>;
} {
  const settleAssessment = vi.fn();
  const endRecovery = vi.fn();
  return {
    properties: {
      definitionKey: RECOVERY_DEFINITION_KEY,
      capturedStartContext: {
        definitionKey: RECOVERY_DEFINITION_KEY,
        assignmentId: 'a1',
        courseId: MOCK_CLASS_ID,
      },
      assignments: [],
      onClose: vi.fn(),
      endRecovery,
      settleAssessment,
      ...overrides,
    } as Parameters<typeof useAssessTaskRecoveryFlow>[0],
    settleAssessment,
    endRecovery,
  };
}

/**
 * Expected upsert call count once both the forced reparse and the approval
 * save have been issued.
 */
const REPARSE_THEN_SAVE_CALL_COUNT = 2;

describe('recovery deferred cancellation settlement', () => {
  it('never resumes the assessment when review is cancelled while the approval save is pending', async () => {
    let resolveSave!: (value: AssignmentDefinition) => void;
    const pendingSave = new Promise<AssignmentDefinition>((resolve) => {
      resolveSave = resolve;
    });
    vi.mocked(getAssignmentDefinition).mockImplementation(() =>
      Promise.resolve(RECOVERY_DEFINITION)
    );
    vi.mocked(upsertAssignmentDefinition)
      .mockReset()
      .mockImplementationOnce(() => Promise.resolve(RECOVERY_DEFINITION))
      .mockImplementationOnce(() => pendingSave);
    vi.mocked(startAssessmentRun).mockImplementation(() => Promise.resolve(null));

    const { wrapper } = createHookWrapper();
    const { properties } = recoveryProperties();
    const { result } = renderHook(() => useAssessTaskRecoveryFlow(properties), { wrapper });

    await act(async () => {
      await result.current.startUpdate();
    });

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(
        REPARSE_THEN_SAVE_CALL_COUNT
      );
    });

    act(() => {
      result.current.cancelReview();
      result.current.handleDiscardConfirm();
    });

    await act(async () => {
      resolveSave(RECOVERY_DEFINITION);
      await savePromise;
    });

    expect(vi.mocked(startAssessmentRun)).not.toHaveBeenCalled();
  });

  it('never settles a success when review is cancelled while the resumed run is pending', async () => {
    let resolveSave!: (value: AssignmentDefinition) => void;
    const pendingSave = new Promise<AssignmentDefinition>((resolve) => {
      resolveSave = resolve;
    });
    let resolveResume!: (value: null) => void;
    const pendingResume = new Promise<null>((resolve) => {
      resolveResume = resolve;
    });
    vi.mocked(getAssignmentDefinition).mockImplementation(() =>
      Promise.resolve(RECOVERY_DEFINITION)
    );
    vi.mocked(upsertAssignmentDefinition)
      .mockReset()
      .mockImplementationOnce(() => Promise.resolve(RECOVERY_DEFINITION))
      .mockImplementationOnce(() => pendingSave);
    vi.mocked(startAssessmentRun).mockImplementationOnce(() => pendingResume);

    const { wrapper } = createHookWrapper();
    const { properties, settleAssessment } = recoveryProperties();
    const { result } = renderHook(() => useAssessTaskRecoveryFlow(properties), { wrapper });

    await act(async () => {
      await result.current.startUpdate();
    });

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(
        REPARSE_THEN_SAVE_CALL_COUNT
      );
    });
    await act(async () => {
      resolveSave(RECOVERY_DEFINITION);
    });
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.cancelReview();
      result.current.handleDiscardConfirm();
    });

    await act(async () => {
      resolveResume(null);
      await savePromise;
    });

    expect(settleAssessment).not.toHaveBeenCalledWith('success', expect.anything());
  });

  it('logs a structured diagnostic when the captured assessment context is missing', async () => {
    vi.mocked(getAssignmentDefinition).mockImplementation(() =>
      Promise.resolve(RECOVERY_DEFINITION)
    );
    vi.mocked(upsertAssignmentDefinition).mockImplementation(() =>
      Promise.resolve(RECOVERY_DEFINITION)
    );
    vi.mocked(startAssessmentRun).mockImplementation(() => Promise.resolve(null));
    const consoleErrorSpy = vi.spyOn(console, 'error');

    const { wrapper } = createHookWrapper();
    const { properties, settleAssessment } = recoveryProperties({ capturedStartContext: null });
    const { result } = renderHook(() => useAssessTaskRecoveryFlow(properties), { wrapper });

    await act(async () => {
      await result.current.startUpdate();
    });
    await act(async () => {
      await result.current.save();
    });

    expect(settleAssessment).toHaveBeenCalledWith('error', expect.any(String));
    const recoveryLogs = consoleErrorSpy.mock.calls.filter(([context]: unknown[]) =>
      String(context).includes('Recovery')
    );
    expect(recoveryLogs.length).toBeGreaterThan(0);
  });
});

describe('assessment and link user-safe error mapping', () => {
  it('renders the shared user-safe copy instead of the raw assessment failure', async () => {
    const { dialog } = renderRecoveryModal({
      setupMocks: () =>
        queueStartResults({
          kind: 'error',
          error: new Error('RAW_DB_CONNECTION_FAILED: sqlite connection lost'),
        }),
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).not.toContain('RAW_DB_CONNECTION_FAILED');
    expect(alert.textContent).toContain('An error occurred. Please try again.');
  });

  it('maps link-confirm failures to shared copy instead of the raw message', async () => {
    const { queryClient, wrapper } = createHookWrapper();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({
        classId: MOCK_CLASS_ID,
        yearGroupKey: RECOVERY_DEFINITION.yearGroupKey,
      }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [
      RECOVERY_DEFINITION as unknown as AssignmentDefinitionPartial,
    ]);
    vi.mocked(upsertAssignmentDefinition).mockImplementation(() =>
      Promise.resolve(RECOVERY_DEFINITION)
    );
    vi.mocked(startAssessmentRun).mockRejectedValue(
      new Error('RAW_LINK_RUN_FAILED: sqlite connection lost')
    );

    const setAssessmentAsError = vi.fn();
    const { result } = renderHook(
      () =>
        useAssessTaskLinkFlow({
          classId: MOCK_CLASS_ID,
          noMatchResolution: 'linking',
          selectedAssignmentForChoice: {
            assignmentId: 'a1',
            title: 'Essay',
            topicId: 'topic-0',
            topicName: 'Synthetic Topic 1',
          },
          sessionReference: { current: 1 },
          selectedAssignmentIdReference: { current: 'a1' },
          setAssessmentState: vi.fn(),
          setAssessmentError: vi.fn(),
          setAssessmentAlertType: vi.fn(),
          setNoMatchResolution: vi.fn(),
          setAssessmentAsError,
          captureStartContext: vi.fn(),
          getPendingStartContext: () => null,
          isAttemptObsolete: () => false,
          transitionToStaleRecovery: vi.fn(),
        }),
      { wrapper }
    );

    act(() => {
      result.current.handleLinkSelect(RECOVERY_DEFINITION_KEY);
    });
    await act(async () => {
      await result.current.handleLinkConfirm();
    });

    expect(setAssessmentAsError).toHaveBeenCalled();
    const message = String(setAssessmentAsError.mock.calls[0]?.[1] ?? '');
    expect(message).not.toContain('RAW_LINK_RUN_FAILED');
  });
});
