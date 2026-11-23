import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { queryKeys } from '@/query/queryKeys';
import type { AssignmentTopic } from '@/services/referenceData/referenceData.zod';
import type { GoogleClassroomAssignmentsResponse } from '@/services/googleClassrooms/googleClassroomAssignments.zod';
import {
  type RenderWithCacheOptions,
  MOCK_CLASS_ID,
  DEFAULT_UPSERT_RESULT,
  selectAssignment,
  clickStartAssessment,
  clickCreateNewDefinition,
} from '@/test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '@/test/classes/AssessTaskModal.link-flow-helpers';
import { setTextboxValue } from '@/test/assignmentDefinition/wizardTestHelpers';
import { getAssignmentTopics } from '@/services/assignmentDefinition/assignmentTopicsService';
import { getYearGroups } from '@/services/referenceData/referenceDataService';

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  vi.clearAllMocks();
  vi.mocked(getAssignmentTopics).mockResolvedValue([]);
  vi.mocked(getYearGroups).mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

/**
 * Renders AssessTaskModal with standard no-match cache data and navigates to
 * the choice state (assignment selected + Start Assessment clicked).
 *
 * @param {Partial<RenderWithCacheOptions>} [options] Additional render options forwarded to `renderWithCache`.
 * @returns {Promise<{ dialog: HTMLElement; queryClient: import('@tanstack/react-query').QueryClient }>}
 *   The dialog and query client.
 */
async function setupWizardTest(options: Partial<RenderWithCacheOptions> = {}) {
  const { dialog, queryClient } = renderWithNoMatchCache(options);

  await selectAssignment(dialog);
  await clickStartAssessment(dialog);

  return { dialog, queryClient };
}

/**
 * Assignment used by the in-modal create-path flow tests, carrying a topic that
 * the cached topic list can resolve so stage-one parse validation passes.
 */
const CREATE_PATH_ASSIGNMENTS: GoogleClassroomAssignmentsResponse = [
  {
    assignmentId: 'a1',
    title: 'Essay',
    creationTime: '2024-09-02T08:30:00.000Z',
    topicName: 'Writing',
    topicId: 'topic-writing',
  },
];

/**
 * Topic pre-populated into the cache before entering the in-modal create path.
 */
const CREATE_PATH_TOPIC: AssignmentTopic = {
  key: 'topic-writing',
  name: 'Writing',
  yearGroupKeys: ['year-10'],
};

/**
 * Complete parse/save response used by the in-modal create-path flow tests: a
 * numeric assignment weighting and one task row are required for stage-two
 * validation and the task-weightings table.
 */
const CREATE_PATH_UPSERT_RESULT = {
  ...DEFAULT_UPSERT_RESULT,
  assignmentWeighting: 1,
  tasks: [{ taskId: 'task-1', taskTitle: 'Solve equations', taskWeighting: 1 }],
};

/**
 * Fills the stage-one document URLs in the in-modal create form and submits a parse.
 *
 * @param {HTMLElement} dialog The owning modal dialog element.
 * @returns {Promise<void>} Resolves once stage two (task weightings) is visible.
 */
async function parseStageOneInModal(dialog: HTMLElement): Promise<void> {
  const referenceInput = await within(dialog).findByRole('textbox', {
    name: /reference document url/i,
  });
  const templateInput = within(dialog).getByRole('textbox', {
    name: /template document url/i,
  });

  setTextboxValue(referenceInput, 'https://docs.google.com/presentation/d/ref-001');
  setTextboxValue(templateInput, 'https://docs.google.com/presentation/d/tpl-001');

  await waitFor(() => {
    expect(within(dialog).getByRole('button', { name: /parse and continue/i })).toBeEnabled();
  });

  await user.click(within(dialog).getByRole('button', { name: /parse and continue/i }));

  await waitFor(() => {
    expect(within(dialog).getByRole('table', { name: /task weightings/i })).toBeInTheDocument();
  });
}

// ---------------------------------------------------------------------------
// No-match resolution — creating state and wizard integration
// ---------------------------------------------------------------------------

describe('No-match resolution — creating state and in-modal create path', () => {
  it('renders the stage-one in-modal create form and pre-populates the assignment title when topicId matches cache', async () => {
    const { dialog, queryClient } = await setupWizardTest({
      assignments: [
        { assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: 'Writing', topicId: 'topic-writing' },
      ],
    });

    // Populate topics cache with a matching topic
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-writing', name: 'Writing', yearGroupKeys: ['year-10'] },
    ]);

    await clickCreateNewDefinition(dialog);

    // The single owning dialog renders the stage-one create form in-modal.
    expect(screen.queryAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Essay'
    );
    expect(within(dialog).getByRole('textbox', { name: /reference document url/i })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: /template document url/i })).toBeInTheDocument();
  });

  it('leaves the topic field empty when topicId is not in the assignmentTopics cache', async () => {
    const { dialog, queryClient } = await setupWizardTest({
      assignments: [
        { assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: 'Writing', topicId: 'unknown-topic' },
      ],
    });

    // Populate topics cache but with NO matching topic
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-maths', name: 'Maths', yearGroupKeys: ['year-10'] },
      { key: 'topic-science', name: 'Science', yearGroupKeys: ['year-10'] },
    ]);

    await clickCreateNewDefinition(dialog);

    // Topic should remain blank because it is not found in the cache.
    expect(within(dialog).getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Essay'
    );
    expect(within(dialog).getByText('Select topic')).toBeInTheDocument();
    expect(within(dialog).queryByText('Writing')).toBeNull();
  });

  it('leaves the topic field empty when topicId is null', async () => {
    const { dialog, queryClient } = await setupWizardTest({
      assignments: [{ assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: 'Writing', topicId: null }],
    });

    // Populate assignmentTopics cache so the test validates the correct code path
    // — topicId is null, so topic should remain blank even when topics are cached.
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-writing', name: 'Writing', yearGroupKeys: ['year-10'] },
    ]);

    await clickCreateNewDefinition(dialog);

    // Topic should remain blank because the assignment has no topicId.
    expect(within(dialog).getByRole('textbox', { name: /assignment title/i })).toHaveValue(
      'Essay'
    );
    expect(within(dialog).getByText('Select topic')).toBeInTheDocument();
    expect(within(dialog).queryByText('Writing')).toBeNull();
  });

  it('calls startAssessmentRun and shows the success state when the in-modal create form saves successfully', async () => {
    const { dialog, queryClient } = await setupWizardTest({
      assignments: CREATE_PATH_ASSIGNMENTS,
      startRunResult: null,
      startRunType: 'resolve',
      upsertResult: CREATE_PATH_UPSERT_RESULT,
      upsertType: 'resolve',
    });
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [CREATE_PATH_TOPIC]);

    await clickCreateNewDefinition(dialog);
    await parseStageOneInModal(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // startAssessmentRun should have been called with the created definition key
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledWith({
        definitionKey: CREATE_PATH_UPSERT_RESULT.definitionKey,
        assignmentId: 'a1',
        courseId: MOCK_CLASS_ID,
      });
    });

    // Success state should be shown
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Footer should show Close button only
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the error state when startAssessmentRun fails after the in-modal create form saves', async () => {
    const apiError = new Error('API failure');
    const { dialog, queryClient } = await setupWizardTest({
      assignments: CREATE_PATH_ASSIGNMENTS,
      startRunResult: apiError,
      startRunType: 'reject',
      upsertResult: CREATE_PATH_UPSERT_RESULT,
      upsertType: 'resolve',
    });
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [CREATE_PATH_TOPIC]);

    await clickCreateNewDefinition(dialog);
    await parseStageOneInModal(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Error alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toContain('API failure');
    expect(alert).toHaveTextContent('An error occurred. Please try again.');
  });

  it('returns to the choice prompt when the in-modal create form is cancelled without edits', async () => {
    const { dialog } = await setupWizardTest();

    await clickCreateNewDefinition(dialog);

    // Cancel from the in-modal create form returns to the choice prompt.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Create New Definition' })
      ).toBeInTheDocument();
    });

    // The in-modal create form is unmounted.
    expect(within(dialog).queryByRole('textbox', { name: /reference document url/i })).toBeNull();
  });

  it('keeps the assignment Select hidden while the in-modal create content is active', async () => {
    const onClose = vi.fn();
    const { dialog } = await setupWizardTest({ onClose });

    await clickCreateNewDefinition(dialog);

    // The owning footer is suppressed while the create content is active, so the
    // assignment Select stays hidden and the stage-one form is the active surface.
    expect(within(dialog).queryByTestId('assignment-select')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Start Assessment' })).toBeNull();
    expect(
      within(dialog).getByRole('textbox', { name: /reference document url/i })
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows correct UI during auto-assessment loading and final state after resolution', async () => {
    const { promise: pendingRun, resolve: resolveRun } = Promise.withResolvers<null>();
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog, queryClient } = await setupWizardTest({
      assignments: CREATE_PATH_ASSIGNMENTS,
      upsertResult: CREATE_PATH_UPSERT_RESULT,
      upsertType: 'resolve',
    });
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [CREATE_PATH_TOPIC]);

    await clickCreateNewDefinition(dialog);
    await parseStageOneInModal(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // During loading: the in-modal create form should be unmounted
    expect(within(dialog).queryByRole('textbox', { name: /reference document url/i })).toBeNull();

    // During loading: assignment Select NOT visible
    expect(within(dialog).queryByTestId('assignment-select')).toBeNull();

    // During loading: footer shows Cancel + disabled Start Assessment
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    const startButton = within(dialog).getByRole('button', { name: /start assessment/i });
    expect(startButton).toBeDisabled();

    // Resolve the API call
    await act(async () => {
      resolveRun(null);
    });

    // After resolution: success state shown
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);

    // Footer should show Close button only
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  it('calls modal onClose when outer Cancel is clicked during auto-assessment loading', async () => {
    const onClose = vi.fn();

    // Mock startAssessmentRun with a pending promise so auto-assessment stays loading
    const pendingRun = new Promise<null>(() => {});
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog, queryClient } = await setupWizardTest({
      assignments: CREATE_PATH_ASSIGNMENTS,
      onClose,
      upsertResult: CREATE_PATH_UPSERT_RESULT,
      upsertType: 'resolve',
    });
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [CREATE_PATH_TOPIC]);

    await clickCreateNewDefinition(dialog);
    await parseStageOneInModal(dialog);

    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // During auto-assessment loading, Cancel should be in the footer
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // Click Cancel — the outer modal's Cancel during creating+loading calls onClose
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
