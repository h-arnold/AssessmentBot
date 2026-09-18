import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { queryKeys } from '../../../query/queryKeys';
import { createAppQueryClient } from '../../../query/queryClient';
import { createFixtureClassPartial } from '../../../test/classes/classesPageTestHelpers';
import { createDefinitionPartial } from '../../../test/classes/matchDefinitionForAssignment.test-utilities';
import type { GoogleClassroomAssignmentsResponse } from '../../../services/googleClassrooms/googleClassroomAssignments.zod';
import {
  MOCK_ASSIGNMENTS,
  MOCK_CLASS_ID,
  MODAL_TITLE,
  clickStartAssessment,
  defaultProperties,
  selectAssignment,
} from '../../../test/classes/AssessTaskModal.test-utilities';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
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

/**
 * Pinned routing surface of the assessment orchestration module. The module
 * owns matching, linking, captured start context and stale-recovery
 * transitions; these red tests pin the recovery routing slot only, not UI.
 */
type AssessmentRecoveryContract = {
  assessmentRecoveryState: 'idle' | 'stale-prompt';
  transitionToStaleRecovery: (definitionKey: string) => void;
};

/**
 * Loads the assessment orchestration module that owns matching, linking,
 * captured start context and stale-recovery transitions for AssessTaskModal.
 *
 * @returns {Promise<Record<string, unknown>>} The imported module namespace.
 */
async function loadAssessmentOrchestrationModule(): Promise<Record<string, unknown>> {
  const modulePath = './useAssessTaskFlow';
  return import(/* @vite-ignore */ modulePath);
}

/**
 * Creates a fresh React Query wrapper for orchestration hook tests.
 *
 * @returns {(properties: Readonly<PropsWithChildren>) => JSX.Element} The query client wrapper used by the tests.
 */
function createOrchestrationWrapper() {
  const queryClient = createAppQueryClient();

  return function OrchestrationWrapper({ children }: Readonly<PropsWithChildren>) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * A deferred assessment-start promise controllable by the calling test.
 */
type DeferredStart = {
  pendingRun: Promise<null>;
  resolveRun: (value: null) => void;
};

/**
 * Creates a deferred assessment-start promise controllable by the test.
 *
 * @returns {DeferredStart} The pending promise and its resolver.
 */
function createDeferredStart(): DeferredStart {
  let resolveRun!: (value: null) => void;
  const pendingRun = new Promise<null>((resolve) => {
    resolveRun = resolve;
  });
  return { pendingRun, resolveRun };
}

/**
 * A modal rendered on the matched path with its assessment start held open.
 */
type MatchedModalWithDeferredStart = {
  dialog: HTMLElement;
  queryClient: QueryClient;
  rerender: ReturnType<typeof render>['rerender'];
  resolveRun: (value: null) => void;
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
  const { pendingRun, resolveRun } = createDeferredStart();

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
  };
}

// ---------------------------------------------------------------------------
// Assessment orchestration recovery contract (routing only, no UI)
// ---------------------------------------------------------------------------

describe('assessment orchestration recovery contract', () => {
  it('exposes an idle recovery state before any stale transition', async () => {
    // RED: the assessment orchestration module does not exist yet. The dynamic
    // import fails until green extracts the module from AssessTaskModal.
    const orchestrationModule = await loadAssessmentOrchestrationModule();
    const useAssessTaskFlow = orchestrationModule.useAssessTaskFlow as () => AssessmentRecoveryContract;

    const { result } = renderHook(() => useAssessTaskFlow(), {
      wrapper: createOrchestrationWrapper(),
    });

    expect(result.current.assessmentRecoveryState).toBe('idle');
  });

  it('moves the recovery state to the stale prompt when transitioning with a definition key', async () => {
    // RED: the assessment orchestration module does not exist yet. The dynamic
    // import fails until green extracts the module from AssessTaskModal.
    const orchestrationModule = await loadAssessmentOrchestrationModule();
    const useAssessTaskFlow = orchestrationModule.useAssessTaskFlow as () => AssessmentRecoveryContract;

    const { result } = renderHook(() => useAssessTaskFlow(), {
      wrapper: createOrchestrationWrapper(),
    });

    await act(async () => {
      result.current.transitionToStaleRecovery('essay-def-key');
    });

    expect(result.current.assessmentRecoveryState).toBe('stale-prompt');
  });
});

// ---------------------------------------------------------------------------
// Obsolete assessment completion guard
// ---------------------------------------------------------------------------

describe('obsolete assessment completion guard', () => {
  it('ignores a matched-path assessment completion that resolves after close and reopen', async () => {
    const { dialog, queryClient, rerender, resolveRun } =
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
      resolveRun(null);
    });

    // RED: the obsolete completion must not mutate the reopened session, so no
    // success alert appears and the selection surface stays idle. Fails now
    // because completions apply unconditionally with no obsolete guard.
    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
    expect(within(reopenedDialog).getByRole('combobox')).toBeInTheDocument();
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

    // RED: the obsolete Essay completion must not start an assessment once the
    // selection moved to Report. Fails now because completions apply
    // unconditionally with no obsolete guard.
    expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });
});
