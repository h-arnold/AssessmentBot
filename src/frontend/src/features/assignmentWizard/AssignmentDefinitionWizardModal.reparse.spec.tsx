/**
 * Behaviour coverage for the Assignments-page update wizard's explicit
 * **Reparse documents** action.
 *
 * These tests pin its update-mode-only placement, its enabling/disabled gating
 * with a visible explanation, the forced reparse request shape (`forceReparse:
 * true` with no weighting patch), in-place task refresh, the busy affordance,
 * its settled state, and the existing blocking-error treatment on failure.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapErrorCodeToUserMessage } from '../../errors/map-error-to-ui';
import { queryKeys } from '../../query/queryKeys';
import {
  UpsertAssignmentDefinitionRequestSchema,
  type AssignmentDefinition,
} from '../../services/assignmentDefinition/assignmentDefinition.zod';
import {
  mockCohorts,
  mockTopics,
  mockYearGroups,
} from '../../test/assignmentDefinition/sharedTestFixtures';
import {
  assertTaskNotVisible,
  assertTaskVisible,
  changeReferenceUrl,
  getFormElements,
  renderWizardModal,
} from '../../test/assignmentDefinition/wizardModalTestHelpers';
import type { RenderWizardModalOptions } from '../../test/assignmentDefinition/wizardModalTestHelpers';
import {
  createStartupWarmupState,
  setTextboxValue,
} from '../../test/assignmentDefinition/wizardTestHelpers';
import editableDefinitionsRaw from '../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

const {
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  upsertAssignmentDefinitionMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  getAssignmentDefinitionMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  upsertAssignmentDefinitionMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
}));

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: vi.fn(),
  logFrontendEvent: vi.fn(),
}));

/** Accessible name of the action under test. */
const REPARSE_DOCUMENTS_ACTION = /reparse documents/i;

/** Visible explanation shown when edits must be saved or discarded first. */
const DISABLED_REPARSE_EXPLANATION = /save or discard/i;

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw
 * text so this spec consumes the committed synthetic fixture rather than a
 * hand-copied literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/** Canonical update-mode definition under test. */
const UPDATE_DEFINITION: AssignmentDefinition = CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/** Definition key reused by the update-mode fixtures and request assertions. */
const UPDATE_DEFINITION_KEY = UPDATE_DEFINITION.definitionKey;

/** Unchanged-URL fixture is refreshed with this replacement reference URL. */
const CHANGED_REFERENCE_URL = 'https://docs.google.com/presentation/d/edited-reference-url';

/** Task title present before the reparse, used to prove in-place replacement. */
const ORIGINAL_FIRST_TASK_TITLE = UPDATE_DEFINITION.tasks[0].taskTitle;

/** Pattern for the task that disappears when the reparsed payload replaces the rows. */
const REMOVED_TASK_PATTERN = /synthetic task 1\.2/i;

/** Task title that survives the reparsed payload under the same task ID. */
const REFRESHED_TASK_TITLE = 'Refreshed quadratic task';

/** Task title introduced by the reparsed payload. */
const NEW_TASK_TITLE = 'Newly parsed task';

/**
 * Builds update-mode render options seeded with the canonical definition fixture.
 *
 * @param {AssignmentDefinition} [definition] - Definition to hydrate the wizard with.
 * @param {Partial<RenderWizardModalOptions>} [overrides] - Per-test option overrides.
 * @returns {RenderWizardModalOptions} Render options for the update wizard.
 */
function createUpdateOptions(
  definition: AssignmentDefinition = UPDATE_DEFINITION,
  overrides: Partial<RenderWizardModalOptions> = {}
): RenderWizardModalOptions {
  return {
    mode: 'update',
    definitionKey: definition.definitionKey,
    assignmentDefinition: definition,
    open: true,
    topics: [...mockTopics],
    yearGroups: [...mockYearGroups],
    cohorts: [...mockCohorts],
    mockInvalidateQueries: true,
    ...overrides,
  };
}

/**
 * Finds the Reparse documents action inside the wizard dialog.
 *
 * @param {HTMLElement} modal - The wizard dialog element.
 * @returns {HTMLElement} The Reparse documents button.
 */
function getReparseDocumentsAction(modal: HTMLElement): HTMLElement {
  return within(modal).getByRole('button', { name: REPARSE_DOCUMENTS_ACTION });
}

beforeEach(() => {
  useStartupWarmupStateMock.mockReturnValue(
    createStartupWarmupState({
      assignmentTopicsStatus: 'ready',
      yearGroupsStatus: 'ready',
    })
  );
  getAssignmentTopicsMock.mockResolvedValue(mockTopics);
  getCohortsMock.mockResolvedValue(mockCohorts);
  getYearGroupsMock.mockResolvedValue(mockYearGroups);
  getAssignmentDefinitionMock.mockResolvedValue(UPDATE_DEFINITION);
  upsertAssignmentDefinitionMock.mockResolvedValue(UPDATE_DEFINITION);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('Reparse documents action placement', () => {
  it('enables the action in update mode with unchanged URLs', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());

    expect(getReparseDocumentsAction(modal)).toBeEnabled();
  });

  it('does not render the action in create mode', async () => {
    const { modal } = await renderWizardModal({
      mode: 'create',
      definitionKey: null,
      open: true,
      topics: [...mockTopics],
      yearGroups: [...mockYearGroups],
      cohorts: [...mockCohorts],
      mockInvalidateQueries: true,
    });

    expect(within(modal).queryByRole('button', { name: REPARSE_DOCUMENTS_ACTION })).toBeNull();
  });

  it('does not reparse documents on modal open or a background refetch', async () => {
    const { modal, queryClient } = await renderWizardModal(
      createUpdateOptions(UPDATE_DEFINITION, { mockInvalidateQueries: false })
    );

    expect(getReparseDocumentsAction(modal)).toBeInTheDocument();
    expect(upsertAssignmentDefinitionMock).not.toHaveBeenCalled();

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: queryKeys.assignmentDefinitionByKey(UPDATE_DEFINITION_KEY),
      });
    });

    expect(upsertAssignmentDefinitionMock).not.toHaveBeenCalled();
  });
});

describe('Reparse documents action gating', () => {
  it('disables the action and explains when unsaved metadata edits exist', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());
    expect(getReparseDocumentsAction(modal)).toBeEnabled();

    const { titleInput } = getFormElements({ modal });
    await act(async () => {
      setTextboxValue(titleInput, 'Edited assignment title');
    });

    await waitFor(() => {
      expect(getReparseDocumentsAction(modal)).toBeDisabled();
    });
    expect(within(modal).getAllByText(DISABLED_REPARSE_EXPLANATION).length).toBeGreaterThan(0);
  });

  it('disables the action while a document URL change is pending', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());

    await changeReferenceUrl({ modal }, CHANGED_REFERENCE_URL);

    await waitFor(() => {
      expect(getReparseDocumentsAction(modal)).toBeDisabled();
    });
    expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
    // The pending-URL reason is explained by the document-change alert alone; the
    // unsaved-edits copy must not leak into this independent disabled reason.
    expect(within(modal).queryByText(DISABLED_REPARSE_EXPLANATION)).toBeNull();
  });

  it('does not offer the action when the loaded definition cannot be trusted', async () => {
    getAssignmentDefinitionMock.mockRejectedValue(new Error('definition load failed'));

    const { modal } = await renderWizardModal(
      createUpdateOptions(UPDATE_DEFINITION, {
        assignmentDefinition: undefined,
        waitForFormFields: false,
      })
    );

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(
        'An error occurred. Please try again.'
      );
    });

    expect(within(modal).queryByRole('button', { name: REPARSE_DOCUMENTS_ACTION })).toBeNull();
  });
});

describe('Reparse documents action behaviour', () => {
  it('forces a reparse and refreshes task rows in place', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());
    assertTaskVisible({ modal }, ORIGINAL_FIRST_TASK_TITLE);

    const reparseResponse: AssignmentDefinition = {
      ...UPDATE_DEFINITION,
      tasks: [
        {
          taskId: UPDATE_DEFINITION.tasks[0].taskId,
          taskTitle: REFRESHED_TASK_TITLE,
          taskWeighting: 2,
        },
        { taskId: 'task-0-new', taskTitle: NEW_TASK_TITLE, taskWeighting: 1 },
      ],
    };
    upsertAssignmentDefinitionMock.mockResolvedValueOnce(reparseResponse);

    await act(async () => {
      fireEvent.click(getReparseDocumentsAction(modal));
    });

    await waitFor(() => {
      expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(1);
    });

    const request = upsertAssignmentDefinitionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(request).toMatchObject({
      definitionKey: UPDATE_DEFINITION_KEY,
      forceReparse: true,
    });
    // Explicit forced requests must omit weighting patches (including empty arrays).
    expect(request).not.toHaveProperty('taskWeightings');
    expect(UpsertAssignmentDefinitionRequestSchema.safeParse(request).success).toBe(true);

    await waitFor(() => {
      assertTaskVisible({ modal }, NEW_TASK_TITLE);
    });
    assertTaskNotVisible({ modal }, REMOVED_TASK_PATTERN);
  });

  it('shows a busy state on the action while the reparse mutation is pending', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());

    let resolveReparse: (value: AssignmentDefinition) => void;
    const pendingReparse = new Promise<AssignmentDefinition>((resolve) => {
      resolveReparse = resolve;
    });
    upsertAssignmentDefinitionMock.mockImplementationOnce(() => pendingReparse);

    await act(async () => {
      fireEvent.click(getReparseDocumentsAction(modal));
    });

    await waitFor(() => {
      expect(getReparseDocumentsAction(modal)).toHaveClass('ant-btn-loading');
    });

    await act(async () => {
      resolveReparse!({ ...UPDATE_DEFINITION });
      await pendingReparse;
    });

    // Settled state: the action is no longer loading and is enabled again.
    await waitFor(() => {
      const action = getReparseDocumentsAction(modal);
      expect(action).toBeEnabled();
      expect(action).not.toHaveClass('ant-btn-loading');
    });
  });

  it('surfaces the blocking error treatment on failure without refreshing tasks', async () => {
    const { modal } = await renderWizardModal(createUpdateOptions());
    assertTaskVisible({ modal }, ORIGINAL_FIRST_TASK_TITLE);

    upsertAssignmentDefinitionMock.mockRejectedValueOnce(
      Object.assign(new Error('parse failed'), { code: 'DEFINITION_PARSE_FAILED' })
    );

    await act(async () => {
      fireEvent.click(getReparseDocumentsAction(modal));
    });

    await waitFor(() => {
      expect(upsertAssignmentDefinitionMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        mapErrorCodeToUserMessage('DEFINITION_PARSE_FAILED')
      );
    });
    // No partial persistence: the failed response must not refresh the saved payload.
    expect(screen.queryByRole('table', { name: /task weightings/i })).toBeNull();
  });
});
