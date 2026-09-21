import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { useAssessTaskFlow } from './useAssessTaskFlow';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { queryKeys } from '../../../query/queryKeys';
import { createAppQueryClient } from '../../../query/queryClient';
import { createFixtureClassPartial } from '../../../test/classes/classesPageTestHelpers';
import { createDefinitionPartial } from '../../../test/classes/matchDefinitionForAssignment.test-utilities';
import { createDeferredPromise } from '../../../test/shared/testDeferredPromise';
import type { GoogleClassroomAssignmentsResponse } from '../../../services/googleClassrooms/googleClassroomAssignments.zod';
import {
  MOCK_ASSIGNMENTS,
  MOCK_CLASS_ID,
  MODAL_TITLE,
  clickStartAssessment,
  defaultProperties,
  seedAssessmentFlowQueryData,
  selectAssignment,
} from '../../../test/classes/AssessTaskModal.test-utilities';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// Two selectable assignments for the selection-change guard test.
const TWO_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [
  { assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: 'Writing', topicId: null },
  { assignmentId: 'a2', title: 'Report', creationTime: '2024-09-03T08:30:00.000Z', topicName: 'Writing', topicId: null },
];
const TWO_ASSIGNMENT_COUNT = TWO_ASSIGNMENTS.length;

/**
 * A deferred assessment-start promise controllable by the calling test.
 */
type DeferredStart = {
  pendingRun: Promise<null>;
  resolveRun: (value: null) => void;
  rejectRun: (reason: unknown) => void;
};

/**
 * Creates a React Query wrapper for direct assessment-flow hook assertions.
 *
 * @returns {(properties: Readonly<PropsWithChildren>) => JSX.Element} A query client wrapper.
 */
function createOrchestrationWrapper() {
  const queryClient = createAppQueryClient();
  return function OrchestrationWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Creates a deferred assessment-start promise controllable by the test.
 *
 * @returns {DeferredStart} The pending promise and its resolver.
 */
function createDeferredStart(): DeferredStart {
  const deferred = createDeferredPromise<null>();
  return {
    pendingRun: deferred.promise,
    resolveRun: deferred.resolvePromise,
    rejectRun: deferred.rejectPromise,
  };
}

/**
 * A modal rendered on the matched path with its assessment start held open.
 */
type MatchedModalWithDeferredStart = {
  dialog: HTMLElement;
  queryClient: QueryClient;
  rerender: ReturnType<typeof render>['rerender'];
  resolveRun: (value: null) => void;
  rejectRun: (reason: unknown) => void;
};

/**
 * Renders AssessTaskModal on the matched path with startAssessmentRun held
 * behind a deferred promise the test resolves when ready.
 *
 * @param {GoogleClassroomAssignmentsResponse} assignments Assignments served by the fetch mock.
 * @returns {MatchedModalWithDeferredStart} Dialog, query client, rerender and resolver.
 */
function renderMatchedModalWithDeferredStart(
  assignments: GoogleClassroomAssignmentsResponse
): MatchedModalWithDeferredStart {
  const matchedDefinition = createDefinitionPartial();
  const { pendingRun, resolveRun, rejectRun } = createDeferredStart();

  vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(assignments);
  vi.mocked(findMatchingDefinition).mockReturnValue({
    kind: 'matched',
    definition: matchedDefinition,
  });
  vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.classPartials(), [
    createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
  ]);
  queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [matchedDefinition]);

  const { rerender } = render(
    <QueryClientProvider client={queryClient}>
      <AssessTaskModal {...defaultProperties()} />
    </QueryClientProvider>
  );

  return {
    dialog: screen.getByRole('dialog', { name: MODAL_TITLE }),
    queryClient,
    rerender,
    resolveRun,
    rejectRun,
  };
}

// ---------------------------------------------------------------------------
// Obsolete assessment completion guard
// ---------------------------------------------------------------------------

describe('obsolete assessment completion guard', () => {
  it('accepts explicit modal context and does not expose a test-only stale transition handler', async () => {
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    const { result } = renderHook(
      () => useAssessTaskFlow({ open: true, classId: MOCK_CLASS_ID }),
      { wrapper: createOrchestrationWrapper() }
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.assessmentRecoveryState).toBe('idle');
    expect(result.current).not.toHaveProperty('transitionToStaleRecovery');
  });

  it('ignores a matched-path assessment rejection that arrives after close and reopen', async () => {
    const { dialog, queryClient, rerender, rejectRun } =
      renderMatchedModalWithDeferredStart(MOCK_ASSIGNMENTS);

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <AssessTaskModal {...defaultProperties({ open: false })} />
        </QueryClientProvider>
      );
    });
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <AssessTaskModal {...defaultProperties()} />
        </QueryClientProvider>
      );
    });

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(reopenedDialog).findByRole('combobox');

    await act(async () => {
      rejectRun(new Error('obsolete start failed'));
    });

    // An obsolete rejection must settle silently: no error alert and no state
    // mutation may leak into the reopened session.
    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
    expect(within(reopenedDialog).getByRole('combobox')).toBeInTheDocument();
  });

  it('ignores a matched-path assessment rejection that arrives after the selection changed', async () => {
    const { dialog, rejectRun } = renderMatchedModalWithDeferredStart(TWO_ASSIGNMENTS);

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await user.click(within(dialog).getByRole('combobox'));
    await user.click(await screen.findByText('Report'));

    await act(async () => {
      rejectRun(new Error('obsolete selection failure'));
    });

    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument();
  });

  it('ignores a matched-path assessment completion that resolves after the selection changed', async () => {
    const { dialog, resolveRun } = renderMatchedModalWithDeferredStart(TWO_ASSIGNMENTS);

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await user.click(within(dialog).getByRole('combobox'));
    await user.click(await screen.findByText('Report'));

    await act(async () => {
      resolveRun(null);
    });

    // The obsolete Essay completion must not start an assessment once the
    // selection moved to Report.
    expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('ignores a link-path assessment rejection that arrives after close and reopen', async () => {
    const deferred = createDeferredStart();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(upsertAssignmentDefinition).mockResolvedValue({} as never);
    vi.mocked(startAssessmentRun).mockReturnValue(deferred.pendingRun);

    const queryClient = createAppQueryClient();
    const definition = createDefinitionPartial();
    seedAssessmentFlowQueryData(queryClient, definition);
    const { result, rerender } = renderHook(
      ({ open }) => useAssessTaskFlow({ open, classId: MOCK_CLASS_ID }),
      { initialProps: { open: true },
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
      }
    );

    await waitFor(() => expect(result.current.assignments).toHaveLength(1));
    act(() => result.current.handleAssignmentChange('a1'));
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });
    await act(async () => {
      await result.current.handleStartAssessment();
    });
    act(() => result.current.handleLinkExistingDefinition());
    act(() => result.current.handleLinkSelect(definition.definitionKey));
    await act(async () => {
      void result.current.handleLinkConfirm();
      await Promise.resolve();
    });

    rerender({ open: false });
    rerender({ open: true });
    await act(async () => {
      deferred.rejectRun(new Error('obsolete link failure'));
      await Promise.resolve();
    });

    expect(result.current.assessmentError).toBeUndefined();
    expect(result.current.noMatchResolution).toBe('idle');
  });

  it('ignores a link-path assessment rejection that arrives after the selection changed', async () => {
    const deferred = createDeferredStart();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(TWO_ASSIGNMENTS);
    vi.mocked(upsertAssignmentDefinition).mockResolvedValue({} as never);
    vi.mocked(startAssessmentRun).mockReturnValue(deferred.pendingRun);

    const queryClient = createAppQueryClient();
    const definition = createDefinitionPartial();
    seedAssessmentFlowQueryData(queryClient, definition);
    const { result } = renderHook(() => useAssessTaskFlow({ open: true, classId: MOCK_CLASS_ID }), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    await waitFor(() => expect(result.current.assignments).toHaveLength(TWO_ASSIGNMENT_COUNT));
    act(() => result.current.handleAssignmentChange('a1'));
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });
    await act(async () => {
      await result.current.handleStartAssessment();
    });
    act(() => result.current.handleLinkExistingDefinition());
    act(() => result.current.handleLinkSelect(definition.definitionKey));
    await act(async () => {
      void result.current.handleLinkConfirm();
      await Promise.resolve();
    });
    act(() => result.current.handleAssignmentChange('a2'));
    await act(async () => {
      deferred.rejectRun(new Error('obsolete link selection failure'));
      await Promise.resolve();
    });

    expect(result.current.assessmentError).toBeUndefined();
    expect(result.current.noMatchResolution).toBe('linking');
  });

  it('ignores a link-path assessment completion that arrives after the selection changed', async () => {
    const deferred = createDeferredStart();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(TWO_ASSIGNMENTS);
    vi.mocked(upsertAssignmentDefinition).mockResolvedValue({} as never);
    vi.mocked(startAssessmentRun).mockReturnValue(deferred.pendingRun);

    const queryClient = createAppQueryClient();
    const definition = createDefinitionPartial();
    seedAssessmentFlowQueryData(queryClient, definition);
    const { result } = renderHook(() => useAssessTaskFlow({ open: true, classId: MOCK_CLASS_ID }), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    await waitFor(() => expect(result.current.assignments).toHaveLength(TWO_ASSIGNMENT_COUNT));
    act(() => result.current.handleAssignmentChange('a1'));
    vi.mocked(findMatchingDefinition).mockReturnValue({ kind: 'no-match' });
    await act(async () => {
      await result.current.handleStartAssessment();
    });
    act(() => result.current.handleLinkExistingDefinition());
    act(() => result.current.handleLinkSelect(definition.definitionKey));
    await act(async () => {
      void result.current.handleLinkConfirm();
      await Promise.resolve();
    });
    act(() => result.current.handleAssignmentChange('a2'));
    await act(async () => {
      deferred.resolveRun(null);
      await Promise.resolve();
    });

    expect(result.current.assessmentError).toBeUndefined();
    expect(result.current.noMatchResolution).toBe('linking');
  });

  it('ignores a create-path assessment rejection that arrives after close and reopen', async () => {
    const deferred = createDeferredStart();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);
    vi.mocked(startAssessmentRun).mockReturnValue(deferred.pendingRun);
    const queryClient = createAppQueryClient();
    const { result, rerender } = renderHook(
      ({ open }) => useAssessTaskFlow({ open, classId: MOCK_CLASS_ID }),
      { initialProps: { open: true },
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
      }
    );

    await waitFor(() => expect(result.current.assignments).toHaveLength(1));
    act(() => result.current.handleAssignmentChange('a1'));
    act(() => result.current.handleCreateNewDefinition());
    act(() => result.current.handleWizardCreateSuccess('created-definition'));
    await waitFor(() => expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1));
    rerender({ open: false });
    rerender({ open: true });
    await act(async () => {
      deferred.rejectRun(new Error('obsolete create failure'));
      await Promise.resolve();
    });

    expect(result.current.assessmentError).toBeUndefined();
    expect(result.current.noMatchResolution).toBe('idle');
  });

  it('ignores a create-path assessment rejection that arrives after the selection changed', async () => {
    const deferred = createDeferredStart();
    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(TWO_ASSIGNMENTS);
    vi.mocked(startAssessmentRun).mockReturnValue(deferred.pendingRun);
    const queryClient = createAppQueryClient();
    const { result } = renderHook(() => useAssessTaskFlow({ open: true, classId: MOCK_CLASS_ID }), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    await waitFor(() => expect(result.current.assignments).toHaveLength(TWO_ASSIGNMENT_COUNT));
    act(() => result.current.handleAssignmentChange('a1'));
    act(() => result.current.handleCreateNewDefinition());
    act(() => result.current.handleWizardCreateSuccess('created-definition'));
    await waitFor(() => expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1));
    act(() => result.current.handleAssignmentChange('a2'));
    await act(async () => {
      deferred.rejectRun(new Error('obsolete create selection failure'));
      await Promise.resolve();
    });

    expect(result.current.assessmentError).toBeUndefined();
    expect(result.current.noMatchResolution).toBe('creating');
  });
});
