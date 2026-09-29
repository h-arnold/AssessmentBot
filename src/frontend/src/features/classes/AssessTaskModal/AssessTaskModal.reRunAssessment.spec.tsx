/**
 * Re-run Assessment entry specs for `AssessTaskModal`.
 *
 * Pins the re-run contract agreed for issue #298: an explicit re-run context
 * starts exactly one assessment run with the persisted definition key (no
 * selection step, no re-matching), the manual entry path stays unchanged, and
 * missing assignments, missing keys, fetch/API failures and stale definitions
 * keep the modal's existing failure and recovery behaviour.
 */

import { StrictMode, type ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { getAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { getAssignmentTopics } from '../../../services/assignmentDefinition/assignmentTopicsService';
import { getCohorts, getYearGroups } from '../../../services/referenceData/referenceDataService';
import { createAppQueryClient } from '../../../query/queryClient';
import { createDefinitionPartial } from '../../../test/classes/matchDefinitionForAssignment.test-utilities';
import { createDeferredPromise } from '../../../test/shared/testDeferredPromise';
import {
  buildNonStaleError,
  buildStaleError,
  CANCEL_BUTTON,
  CLOSE_BUTTON,
  CREATE_BUTTON,
  DEFINITION_STALE_MESSAGE,
  getVisibleActionNames,
  NON_STALE_FAILURE_MESSAGE,
  RECOVERY_DEFINITION,
  RETRY_BUTTON,
  START_ASSESSMENT_BUTTON,
  UPDATE_BUTTON,
} from '../../../test/classes/AssessTaskModal.recovery-helpers';
import {
  MOCK_ASSIGNMENTS,
  MOCK_CLASS_ID,
  MODAL_TITLE,
  clickStartAssessment,
  defaultProperties,
  seedAssessmentFlowQueryData,
  selectAssignment,
} from '../../../test/classes/AssessTaskModal.test-utilities';
import type { GoogleClassroomAssignmentsResponse } from '../../../services/googleClassrooms/googleClassroomAssignments.zod';
import type { ReRunContext } from '../../shared/reRunAssessmentContext';

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

/** Definition key persisted on the previously assessed assignment. */
const PERSISTED_DEFINITION_KEY = 'essay-def-key';

/** Definition key that a title/topic re-match would pick instead. */
const DECOY_DEFINITION_KEY = 'decoy-def-key';

/** The re-run context for the previously assessed assignment, pinned to the canonical contract. */
const RE_RUN_CONTEXT: ReRunContext = {
  assignmentId: 'a1',
  definitionKey: PERSISTED_DEFINITION_KEY,
};

/** Accessible name of the re-run footer's primary action while a run is in flight. */
const RE_RUN_ASSESSMENT_BUTTON = 'Re-run Assessment';

/** Modal properties overridden by the re-run specs. */
type ReRunModalProperties = Readonly<{
  open?: boolean;
  reRunContext?: ReRunContext | null;
}>;

/** Render options for {@link renderReRunModal}. */
type RenderReRunModalOptions = Readonly<{
  strictMode?: boolean;
  /** Year-group key seeded on the class partial; null models a class with no year group. */
  yearGroupKey?: string | null;
  definitionKey?: string;
}>;

/** The owning dialog, its query client plus a rerender hook that keeps the query provider. */
type RenderedReRunModal = Readonly<{
  dialog: HTMLElement;
  queryClient: QueryClient;
  rerender: (next: ReRunModalProperties) => void;
}>;

/** Classroom assignment whose title and topic no longer match the persisted key. */
const RENAMED_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [
  {
    assignmentId: 'a1',
    title: 'Renamed Essay',
    creationTime: '2024-09-02T08:30:00.000Z',
    topicName: 'Renamed Topic',
    topicId: null,
  },
];

/** Re-run contexts that must fail closed instead of starting an assessment. */
const RE_RUN_FAILURE_CASES = [
  {
    caseName: 'the requested assignment is missing from the class',
    context: { assignmentId: 'missing-assignment', definitionKey: PERSISTED_DEFINITION_KEY },
  },
  {
    caseName: 'the re-run context carries no definition key',
    context: { assignmentId: 'a1', definitionKey: null },
  },
  {
    caseName: 'the persisted definition key is not in the registry',
    context: { assignmentId: 'a1', definitionKey: 'deleted-def-key' },
  },
] as const;

/**
 * Builds the modal properties from the shared defaults plus the re-run entry.
 *
 * @param {ReRunModalProperties} [overrides] Overrides for the modal under test.
 * @returns {object} The complete modal properties.
 */
function buildModalProperties(overrides: ReRunModalProperties = {}) {
  const { open = true, reRunContext } = overrides;
  return {
    ...defaultProperties(),
    open,
    ...(reRunContext === undefined ? {} : { reRunContext }),
  };
}

/**
 * Seeds the assessment caches and renders `AssessTaskModal`, optionally inside
 * React StrictMode, returning the dialog and a provider-preserving rerender.
 *
 * @param {ReRunModalProperties} [overrides] Overrides for the modal under test.
 * @param {RenderReRunModalOptions} [options] Render options.
 * @returns {RenderedReRunModal} The owning dialog and the rerender hook.
 */
function renderReRunModal(
  overrides: ReRunModalProperties = {},
  options: RenderReRunModalOptions = {}
): RenderedReRunModal {
  const {
    strictMode,
    yearGroupKey = 'year-10',
    definitionKey = PERSISTED_DEFINITION_KEY,
  } = options;
  const queryClient = createAppQueryClient();
  seedAssessmentFlowQueryData(
    queryClient,
    createDefinitionPartial({ definitionKey }),
    MOCK_CLASS_ID,
    yearGroupKey
  );

  const buildUi = (properties: ReRunModalProperties): ReactElement => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...buildModalProperties(properties)} />
      </QueryClientProvider>
    );
    return strictMode === true ? <StrictMode>{tree}</StrictMode> : tree;
  };

  const view = render(buildUi(overrides));
  return {
    dialog: screen.getByRole('dialog', { name: MODAL_TITLE }),
    queryClient,
    rerender: (next: ReRunModalProperties): void => {
      view.rerender(buildUi(next));
    },
  };
}

beforeEach(() => {
  vi.mocked(getGoogleClassroomAssignments).mockImplementation(() =>
    Promise.resolve(MOCK_ASSIGNMENTS)
  );
  vi.mocked(findMatchingDefinition).mockImplementation(() => ({
    kind: 'matched',
    definition: createDefinitionPartial({ definitionKey: PERSISTED_DEFINITION_KEY }),
  }));
  vi.mocked(startAssessmentRun).mockImplementation(() => Promise.resolve(null));
  vi.mocked(getAssignmentDefinition).mockImplementation(() => Promise.resolve(RECOVERY_DEFINITION));
  vi.mocked(getAssignmentTopics).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getCohorts).mockImplementation(() => Promise.resolve([]));
  vi.mocked(getYearGroups).mockImplementation(() => Promise.resolve([]));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('AssessTaskModal — Re-run Assessment entry', () => {
  it('starts exactly one assessment run from the re-run context without a selection step', async () => {
    const { dialog } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    expect(startAssessmentRun).toHaveBeenCalledWith({
      definitionKey: PERSISTED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    const alert = await within(dialog).findByRole('alert');
    expect(alert.className).toContain('ant-alert-success');
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
  });

  it('reuses the persisted definition key even when the Classroom title and topic changed', async () => {
    vi.mocked(getGoogleClassroomAssignments).mockImplementation(() =>
      Promise.resolve(RENAMED_ASSIGNMENTS)
    );
    vi.mocked(findMatchingDefinition).mockImplementation(() => ({
      kind: 'matched',
      definition: createDefinitionPartial({
        definitionKey: DECOY_DEFINITION_KEY,
        primaryTitle: 'Renamed Essay',
        primaryTopic: 'Renamed Topic',
      }),
    }));

    const { dialog } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });

    const alert = await within(dialog).findByRole('alert');
    expect(alert.className).toContain('ant-alert-success');
    expect(findMatchingDefinition).not.toHaveBeenCalled();
    expect(startAssessmentRun).toHaveBeenCalledWith({
      definitionKey: PERSISTED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
  });

  it('keeps the manual selection path unchanged when no re-run context is supplied', async () => {
    const { dialog } = renderReRunModal();

    await selectAssignment(dialog);
    expect(startAssessmentRun).not.toHaveBeenCalled();

    await clickStartAssessment(dialog);

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    expect(startAssessmentRun).toHaveBeenCalledWith({
      definitionKey: PERSISTED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    expect(findMatchingDefinition).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument();
  });

  it.each(RE_RUN_FAILURE_CASES)(
    'fails closed without starting when $caseName',
    async ({ context }) => {
      const { dialog } = renderReRunModal({ reRunContext: context });

      const alert = await within(dialog).findByRole('alert');
      expect(alert.className).toMatch(/ant-alert-(error|warning)/);
      expect(startAssessmentRun).not.toHaveBeenCalled();
      expect(findMatchingDefinition).not.toHaveBeenCalled();
      expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
    }
  );

  it('fails closed without starting when the assignments fetch rejects', async () => {
    vi.mocked(getGoogleClassroomAssignments).mockImplementation(() =>
      Promise.reject(new Error('assignments fetch failed'))
    );

    const { dialog } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });

    const alert = await within(dialog).findByRole('alert');
    expect(alert.className).toContain('ant-alert-error');
    expect(startAssessmentRun).not.toHaveBeenCalled();
  });

  it('reports a non-stale start failure once without offering definition recovery', async () => {
    vi.mocked(startAssessmentRun).mockImplementation(() => Promise.reject(buildNonStaleError()));

    const { dialog } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(NON_STALE_FAILURE_MESSAGE);
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
    expect(within(dialog).queryByRole('button', { name: UPDATE_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
  });

  it('routes a stale start rejection to the existing definition recovery prompt', async () => {
    vi.mocked(startAssessmentRun).mockImplementation(() => Promise.reject(buildStaleError()));

    const { dialog } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });

    await within(dialog).findByRole('button', { name: UPDATE_BUTTON });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(DEFINITION_STALE_MESSAGE);
    expect(within(dialog).queryByRole('button', { name: CREATE_BUTTON })).toBeNull();
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
  });

  it('starts a single assessment run when rendered under React StrictMode', async () => {
    const { dialog } = renderReRunModal({ reRunContext: RE_RUN_CONTEXT }, { strictMode: true });

    const alert = await within(dialog).findByRole('alert');
    expect(alert.className).toContain('ant-alert-success');
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
  });

  it('does not restart or surface stale results after close and reopen with a cleared context', async () => {
    const pendingRun = createDeferredPromise<null>();
    vi.mocked(startAssessmentRun).mockImplementation(() => pendingRun.promise);

    const { rerender } = renderReRunModal({
      reRunContext: RE_RUN_CONTEXT,
    });
    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender({ open: false, reRunContext: null });
    });
    await act(async () => {
      rerender({ open: true, reRunContext: null });
    });

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(reopenedDialog).findByRole('combobox');
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingRun.rejectPromise(new Error('obsolete re-run failure'));
      await Promise.resolve();
    });

    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
    expect(within(reopenedDialog).getByRole('combobox')).toBeInTheDocument();
  });

  it('ignores a successful obsolete completion after close and reopen with a cleared context', async () => {
    const pendingRun = createDeferredPromise<null>();
    vi.mocked(startAssessmentRun).mockImplementation(() => pendingRun.promise);

    const { rerender } = renderReRunModal({ reRunContext: RE_RUN_CONTEXT });
    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));

    await act(async () => {
      rerender({ open: false, reRunContext: null });
    });
    await act(async () => {
      rerender({ open: true, reRunContext: null });
    });

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(reopenedDialog).findByRole('combobox');

    await act(async () => {
      pendingRun.resolvePromise(null);
      await Promise.resolve();
    });

    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
    expect(within(reopenedDialog).getByRole('combobox')).toBeInTheDocument();
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
  });

  it('retries a transient start failure with a single extra assessment run', async () => {
    vi.mocked(startAssessmentRun).mockImplementationOnce(() =>
      Promise.reject(buildNonStaleError())
    );
    const user = userEvent.setup();

    const { dialog } = renderReRunModal({ reRunContext: RE_RUN_CONTEXT });

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(NON_STALE_FAILURE_MESSAGE);
    expect(startAssessmentRun).toHaveBeenCalledTimes(1);
    expect(getVisibleActionNames(dialog)).toEqual([CANCEL_BUTTON, RETRY_BUTTON]);

    // antd leaves its loading icon in the exit animation after the
    // loading→error transition, so match the visible Retry label.
    await user.click(within(dialog).getByRole('button', { name: /Retry/ }));

    const expectedRunCount = 2;
    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(expectedRunCount));
    expect(startAssessmentRun).toHaveBeenLastCalledWith({
      definitionKey: PERSISTED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    await waitFor(() => expect(getVisibleActionNames(dialog)).toContain(CLOSE_BUTTON));
  });

  it('offers only Cancel when the re-run is permanently blocked', async () => {
    const { dialog } = renderReRunModal({
      reRunContext: { assignmentId: 'a1', definitionKey: null },
    });

    await within(dialog).findByRole('alert');
    expect(getVisibleActionNames(dialog)).toEqual([CANCEL_BUTTON]);
    expect(startAssessmentRun).not.toHaveBeenCalled();
  });

  it('recovers a retryable missing-definition cache block through the Retry action', async () => {
    const user = userEvent.setup();
    const { dialog, queryClient } = renderReRunModal(
      { reRunContext: RE_RUN_CONTEXT },
      { definitionKey: DECOY_DEFINITION_KEY }
    );

    const blockedAlert = await within(dialog).findByRole('alert');
    expect(blockedAlert).toHaveTextContent('The saved assessment definition could not be found.');
    expect(getVisibleActionNames(dialog)).toEqual([CANCEL_BUTTON, RETRY_BUTTON]);
    expect(startAssessmentRun).not.toHaveBeenCalled();

    seedAssessmentFlowQueryData(
      queryClient,
      createDefinitionPartial({ definitionKey: PERSISTED_DEFINITION_KEY })
    );
    await user.click(within(dialog).getByRole('button', { name: RETRY_BUTTON }));

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(within(dialog).getByRole('alert')).toHaveTextContent("Assessment started for 'Essay'.")
    );
  });

  it('starts a re-run for a class whose cached year group is null', async () => {
    const { dialog } = renderReRunModal({ reRunContext: RE_RUN_CONTEXT }, { yearGroupKey: null });

    await waitFor(() => expect(startAssessmentRun).toHaveBeenCalledTimes(1));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.className).toContain('ant-alert-success');
    expect(alert).toHaveTextContent("Assessment started for 'Essay'.");
  });

  it('labels the loading and success re-run surfaces without the internal key or Start Assessment action', async () => {
    const pendingRun = createDeferredPromise<null>();
    vi.mocked(startAssessmentRun).mockImplementation(() => pendingRun.promise);

    const { dialog } = renderReRunModal({ reRunContext: RE_RUN_CONTEXT });

    // Ant Design appends "loading" to the accessible name of a loading button.
    const loadingPrimary = await within(dialog).findByRole('button', {
      name: `loading ${RE_RUN_ASSESSMENT_BUTTON}`,
    });
    expect(loadingPrimary).toBeDisabled();
    expect(getVisibleActionNames(dialog)).toEqual([CANCEL_BUTTON, RE_RUN_ASSESSMENT_BUTTON]);
    expect(within(dialog).getByText(/Re-run assessment for 'Essay'/)).toBeInTheDocument();
    expect(within(dialog).queryByText(new RegExp(PERSISTED_DEFINITION_KEY))).toBeNull();

    await act(async () => {
      pendingRun.resolvePromise(null);
      await Promise.resolve();
    });

    const successAlert = await within(dialog).findByRole('alert');
    expect(successAlert.className).toContain('ant-alert-success');
    expect(getVisibleActionNames(dialog)).toContain(CLOSE_BUTTON);
    expect(within(dialog).queryByRole('button', { name: RE_RUN_ASSESSMENT_BUTTON })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: START_ASSESSMENT_BUTTON })).toBeNull();
    expect(within(dialog).queryByText(new RegExp(PERSISTED_DEFINITION_KEY))).toBeNull();
  });
});
