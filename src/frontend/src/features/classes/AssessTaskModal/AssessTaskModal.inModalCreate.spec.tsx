/**
 * In-modal create-path composition specs for `AssessTaskModal`.
 *
 * These specs pin SPEC decision 9: after choosing Create, the assignment-definition
 * wizard content renders inside the single owning `AssessTaskModal` rather than a
 * stacked second modal. They drive the real create journey (choice → stage-one URL
 * entry → stage-two review → auto-assessment) through user-visible interactions and
 * assert the one-modal composition, footer ownership, width-token behaviour and the
 * existing parse-failure treatment.
 *
 * Red phase: these specs fail while `AssessTaskModal` still renders the stacked
 * `AssignmentDefinitionWizardModal` instance, because the stage-one/stage-two content
 * lives in a second dialog instead of the owning modal body. They pass once the
 * extracted chrome-free review content renders in-modal.
 */

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../query/queryKeys';
import { ApiTransportError } from '../../../errors/apiTransportError';
import {
  clickCreateNewDefinition,
  clickStartAssessment,
  MOCK_CLASS_ID,
  selectAssignment,
} from '../../../test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '../../../test/classes/AssessTaskModal.link-flow-helpers';
import { setTextboxValue } from '../../../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
} from '../../../test/assignmentDefinition/sharedTestFixtures';
import type { AssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinition.zod';
import type { GoogleClassroomAssignmentsResponse } from '../../../services/googleClassrooms/googleClassroomAssignments.zod';
import editableDefinitionsRaw from '../../../../../../tests/__mocks__/data/synthetic-analysis/small/editableDefinitions.json?raw';

const {
  getGoogleClassroomAssignmentsMock,
  startAssessmentRunMock,
  upsertAssignmentDefinitionMock,
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  findMatchingDefinitionMock,
} = vi.hoisted(() => ({
  getGoogleClassroomAssignmentsMock: vi.fn(),
  startAssessmentRunMock: vi.fn(),
  upsertAssignmentDefinitionMock: vi.fn(),
  getAssignmentDefinitionMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  findMatchingDefinitionMock: vi.fn(),
}));

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: getGoogleClassroomAssignmentsMock,
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: startAssessmentRunMock,
}));

vi.mock('../../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
  getAssignmentDefinition: getAssignmentDefinitionMock,
}));

vi.mock('../../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: findMatchingDefinitionMock,
}));

/**
 * Approved shared modal-width exception token applied while wizard content is active.
 */
const WIDE_DATA_WIDTH = 'var(--app-modal-width-wide-data)';

/**
 * Registry copy for the stable `DEFINITION_PARSE_FAILED` code (SPEC decision 8).
 */
const DEFINITION_PARSE_FAILED_MESSAGE =
  'The assignment documents could not be parsed. Check the reference and template documents, then try again.';

/**
 * Canonical small-profile `transport.editableDefinitions` view, imported as raw text
 * so these specs consume the committed synthetic fixture rather than a hand-copied
 * literal that can silently drift from it.
 */
const CANONICAL_EDITABLE_DEFINITIONS = JSON.parse(editableDefinitionsRaw) as Record<
  string,
  AssignmentDefinition
>;

/**
 * Canonical `definition-0-slides` record used as the mocked create parse/save response.
 */
const CANONICAL_CREATE_DEFINITION: AssignmentDefinition =
  CANONICAL_EDITABLE_DEFINITIONS['definition-0-slides'];

/**
 * Definition key returned by the mocked create parse/save responses.
 */
const CREATED_DEFINITION_KEY = CANONICAL_CREATE_DEFINITION.definitionKey;

/**
 * Repeated accessible names hoisted to constants (sonarjs duplicate-string rule).
 */
const CANCEL_BUTTON_NAME = 'Cancel';
const CREATE_BUTTON_NAME = 'Create New Definition';
const REFERENCE_URL_PATTERN = /reference document url/i;
const TEMPLATE_URL_PATTERN = /template document url/i;
const PARSE_BUTTON_PATTERN = /parse and continue/i;
const TASK_TABLE_PATTERN = /task weightings/i;
const DISCARD_DIALOG_PATTERN = /discard changes/i;

/**
 * Assignment chosen in the no-match flow. The topic ID matches the cached topics so
 * the wizard's create-mode initial values pre-populate title, topic and year group,
 * leaving only the document URLs for the test to type.
 */
const NO_MATCH_ASSIGNMENT: GoogleClassroomAssignmentsResponse = [
  {
    assignmentId: 'a1',
    title: 'Essay',
    creationTime: '2024-09-02T08:30:00.000Z',
    topicName: 'Algebra',
    topicId: 'topic-algebra',
  },
];

let user: ReturnType<typeof userEvent.setup>;

/**
 * Renders the assessment modal in the no-match choice prompt.
 *
 * @returns {Promise<{ dialog: HTMLElement; queryClient: QueryClient }>} The owning dialog and its query client.
 */
async function renderNoMatchChoice(): Promise<{ dialog: HTMLElement; queryClient: QueryClient }> {
  const { dialog, queryClient } = renderWithNoMatchCache({
    assignments: NO_MATCH_ASSIGNMENT,
  });

  await selectAssignment(dialog);
  await clickStartAssessment(dialog);

  return { dialog, queryClient };
}

/**
 * Opens the genuine create path in-modal from the no-match choice prompt.
 *
 * @returns {Promise<{ dialog: HTMLElement; queryClient: QueryClient }>} The owning dialog and its query client.
 */
async function openInModalCreate(): Promise<{ dialog: HTMLElement; queryClient: QueryClient }> {
  const { dialog, queryClient } = await renderNoMatchChoice();

  queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
  await clickCreateNewDefinition(dialog);

  return { dialog, queryClient };
}

/**
 * Types the two required document URLs and waits for stage one to become submittable.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {Promise<void>} Resolves when the stage-one primary action is enabled.
 */
async function fillStageOneUrls(dialog: HTMLElement): Promise<void> {
  const referenceInput = await within(dialog).findByRole('textbox', {
    name: REFERENCE_URL_PATTERN,
  });
  const templateInput = within(dialog).getByRole('textbox', { name: TEMPLATE_URL_PATTERN });

  setTextboxValue(referenceInput, 'https://docs.google.com/presentation/d/ref-001');
  setTextboxValue(templateInput, 'https://docs.google.com/presentation/d/tpl-001');

  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: PARSE_BUTTON_PATTERN })).toBeEnabled();
  });
}

/**
 * Builds a fresh create parse/save response from the canonical editable-definition seed.
 *
 * @returns {AssignmentDefinition} A copy of the canonical definition safe for per-test mutation.
 */
function buildCreateUpsertResponse(): AssignmentDefinition {
  return {
    ...CANONICAL_CREATE_DEFINITION,
    tasks: CANONICAL_CREATE_DEFINITION.tasks.map((task) => ({ ...task })),
  };
}

/**
 * Runs a successful stage-one parse and waits for the stage-two review surface.
 *
 * @param {HTMLElement} dialog - The owning modal dialog element.
 * @returns {Promise<void>} Resolves when the task weightings table is visible in-modal.
 */
async function parseStageOne(dialog: HTMLElement): Promise<void> {
  upsertAssignmentDefinitionMock.mockResolvedValueOnce(buildCreateUpsertResponse());

  await user.click(within(dialog).getByRole('button', { name: PARSE_BUTTON_PATTERN }));

  await waitFor(() => {
    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();
  });
}

describe('AssessTaskModal in-modal create path', () => {
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    getAssignmentTopicsMock.mockResolvedValue(mockTopics);
    getYearGroupsMock.mockResolvedValue(mockYearGroups);
    getCohortsMock.mockResolvedValue([]);
    startAssessmentRunMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders stage-one URL entry inside the single owning dialog when Create is chosen', async () => {
    const { dialog } = await renderNoMatchChoice();

    // No wizard content is active yet, so the owning modal keeps its default width.
    expect(dialog.style.width).not.toBe(WIDE_DATA_WIDTH);

    await clickCreateNewDefinition(dialog);

    // One modal at a time: exactly one dialog, with no stacked create wizard dialog.
    await waitFor(() => {
      expect(screen.queryAllByRole('dialog')).toHaveLength(1);
    });
    expect(screen.queryByRole('dialog', { name: /create assignment/i })).toBeNull();

    // Stage-one URL entry renders in the owning modal body.
    expect(
      await within(dialog).findByRole('textbox', { name: REFERENCE_URL_PATTERN })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: TEMPLATE_URL_PATTERN })).toBeInTheDocument();

    // The owning footer is suppressed while wizard content is active.
    expect(within(dialog).queryByRole('button', { name: 'Start Assessment' })).toBeNull();

    // The wide-data width token is applied while wizard content is active.
    await waitFor(() => {
      expect(dialog.style.width).toBe(WIDE_DATA_WIDTH);
    });
  });

  it('transitions from stage one to stage two inside the owning dialog after a successful parse', async () => {
    const { dialog } = await openInModalCreate();

    await fillStageOneUrls(dialog);
    await parseStageOne(dialog);

    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('spinbutton', { name: /assignment weighting/i })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('dialog')).toHaveLength(1);
    expect(dialog.style.width).toBe(WIDE_DATA_WIDTH);
  });

  it('returns to the choice prompt when the in-modal review is cancelled without edits', async () => {
    const { dialog } = await openInModalCreate();

    const cancelButton = await within(dialog).findByRole('button', {
      name: CANCEL_BUTTON_NAME,
    });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: CREATE_BUTTON_NAME })
      ).toBeInTheDocument();
    });
    expect(screen.queryAllByRole('dialog')).toHaveLength(1);
    expect(dialog.style.width).not.toBe(WIDE_DATA_WIDTH);
  });

  it('confirms discard for dirty in-modal review edits and returns to the choice prompt', async () => {
    const { dialog } = await openInModalCreate();

    await fillStageOneUrls(dialog);
    await parseStageOne(dialog);

    const titleInput = within(dialog).getByRole('textbox', { name: /assignment title/i });
    setTextboxValue(titleInput, 'Changed title');

    await user.click(within(dialog).getByRole('button', { name: CANCEL_BUTTON_NAME }));

    const discardDialog = await screen.findByRole('dialog', { name: DISCARD_DIALOG_PATTERN });
    expect(within(discardDialog).getByText(/unsaved changes/i)).toBeInTheDocument();

    await user.click(within(discardDialog).getByRole('button', { name: /keep editing/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: DISCARD_DIALOG_PATTERN })).toBeNull();
    });
    expect(within(dialog).getByRole('table', { name: TASK_TABLE_PATTERN })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: CANCEL_BUTTON_NAME }));
    const secondDiscardDialog = await screen.findByRole('dialog', {
      name: DISCARD_DIALOG_PATTERN,
    });
    await user.click(
      within(secondDiscardDialog).getByRole('button', { name: DISCARD_DIALOG_PATTERN })
    );

    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: CREATE_BUTTON_NAME })
      ).toBeInTheDocument();
    });
  });

  it('starts the auto-assessment only after the in-modal wizard content unmounts on save', async () => {
    const { dialog } = await openInModalCreate();

    await fillStageOneUrls(dialog);
    await parseStageOne(dialog);

    let wasWizardContentMounted: boolean | null = null;
    let dialogCountAtStartCall: number | null = null;
    startAssessmentRunMock.mockImplementation(() => {
      wasWizardContentMounted = screen.queryByRole('table', { name: TASK_TABLE_PATTERN }) !== null;
      dialogCountAtStartCall = screen.queryAllByRole('dialog').length;
      return Promise.resolve(null);
    });
    upsertAssignmentDefinitionMock.mockResolvedValueOnce(buildCreateUpsertResponse());

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(startAssessmentRunMock).toHaveBeenCalledTimes(1);
    });
    expect(startAssessmentRunMock).toHaveBeenCalledWith({
      definitionKey: CREATED_DEFINITION_KEY,
      assignmentId: 'a1',
      courseId: MOCK_CLASS_ID,
    });
    expect(wasWizardContentMounted).toBe(false);
    expect(dialogCountAtStartCall).toBe(1);

    const successAlert = await within(dialog).findByRole('alert');
    expect(successAlert).toHaveTextContent(/assessment started for/i);
    expect(successAlert).toHaveTextContent(/Essay/);
  });

  it('shows the blocking parse-failure alert in the owning dialog without starting an assessment', async () => {
    const { dialog } = await openInModalCreate();

    await fillStageOneUrls(dialog);

    const parseFailure = new ApiTransportError({
      requestId: 'request-parse-failure',
      error: { code: 'DEFINITION_PARSE_FAILED', message: 'raw parse failure' },
    });
    upsertAssignmentDefinitionMock.mockRejectedValueOnce(parseFailure);

    await user.click(within(dialog).getByRole('button', { name: PARSE_BUTTON_PATTERN }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(DEFINITION_PARSE_FAILED_MESSAGE);
    expect(within(dialog).queryByRole('table', { name: TASK_TABLE_PATTERN })).toBeNull();
    expect(startAssessmentRunMock).not.toHaveBeenCalled();
  });
});
