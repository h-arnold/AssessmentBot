import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { AssessTaskModal } from './AssessTaskModal';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import {
  getAssignmentDefinition,
  upsertAssignmentDefinition,
} from '@/services/assignmentDefinition/assignmentDefinitionService';
import { queryKeys } from '@/query/queryKeys';
import { ApiTransportError } from '@/errors/apiTransportError';
import {
  MOCK_CLASS_ID,
  MODAL_TITLE,
  DEFAULT_UPSERT_RESULT,
  defaultProperties,
  selectAssignment,
  clickStartAssessment,
  clickLinkToExisting,
  expectLinkButtonDisabled,
} from '@/test/classes/AssessTaskModal.test-utilities';
import {
  renderWithNoMatchCache,
  performLinkFlow,
} from '@/test/classes/AssessTaskModal.link-flow-helpers';
import { createDefinitionPartial } from '@/test/classes/matchDefinitionForAssignment.test-utilities';
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


// ---------------------------------------------------------------------------
// No-match resolution — linking state and link flow
// ---------------------------------------------------------------------------

describe('No-match resolution — linking state and link flow', () => {
  it('choice prompt: Link to Existing Definition button is enabled when at least one linkable definition exists', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const linkButton = await within(dialog).findByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeEnabled();
  });

  it('choice prompt: Link to Existing Definition button is disabled with Tooltip when the picker would be empty', async () => {
    const { dialog } = renderWithNoMatchCache({
      definitionPartials: [createDefinitionPartial({ yearGroupKey: 'year-11' })],
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const linkButton = await within(dialog).findByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeDisabled();

    // Trigger the tooltip by hovering over the button wrapper
    const buttonParent = linkButton.parentElement;
    if (buttonParent) {
      fireEvent.pointerEnter(buttonParent);
    }

    await screen.findByText("No assignment definitions exist for this class's year group.");
  });

  it('choice prompt: clicking Link to Existing Definition transitions to linking state', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    await clickLinkToExisting(dialog);

    // The linkable-definition Select combobox should appear in the linking
    // state. The assignment Select is hidden during choice/linking, so only
    // the linkable Select combobox should be present.
    const comboboxes = await within(dialog).findAllByRole('combobox');
    expect(comboboxes).toHaveLength(1);

    // Choice buttons should be gone
    expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })).toBeNull();
  });

  it('picker: clicking Cancel returns to the choice prompt', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    // Click Cancel in the picker footer
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // Choice buttons should reappear
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Link to Existing Definition' })).toBeInTheDocument();
    });

    // Picker should be gone — in choice state there are no comboboxes
    // (the assignment Select is hidden during choice/linking).
    expect(within(dialog).queryByRole('combobox')).toBeNull();
  });

  it('picker: Link button is disabled when no row is selected', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    expectLinkButtonDisabled(dialog);

    // Verify the Tooltip explains why the button is disabled
    const linkButton = within(dialog).getByRole('button', { name: 'Link' });
    const buttonParent = linkButton.parentElement;
    if (buttonParent) {
      fireEvent.pointerEnter(buttonParent);
    }
    await screen.findByText('Select a definition to link.');
  });

  it('picker: clicking a row and clicking Link calls upsertAssignmentDefinition and then startAssessmentRun', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: null,
      startRunType: 'resolve',
    });

    await performLinkFlow(dialog);

    // upsertAssignmentDefinition should have been called with the ID-shape payload
    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(1);
    });

    const upsertPayload = vi.mocked(upsertAssignmentDefinition).mock.calls[0][0];
    expect(upsertPayload).toMatchObject({
      definitionKey: 'essay-def-key',
      primaryTitle: 'Essay',
      primaryTopicKey: 'topic-writing',
      yearGroupKey: 'year-10',
      referenceDocumentId: 'ref-001',
      templateDocumentId: 'tpl-001',
      documentType: 'SLIDES',
      alternateTitles: expect.any(Array),
      alternateTopics: expect.any(Array),
    });

    // startAssessmentRun should have been called after the upsert resolved
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledWith({
        definitionKey: 'essay-def-key',
        assignmentId: 'a1',
        courseId: MOCK_CLASS_ID,
      });
    });
  });

  it('picker: empty Google Classroom topic name sends alternateTopics unchanged (not [])', async () => {
    const { dialog } = renderWithNoMatchCache({
      definitionPartials: [
        createDefinitionPartial({
          alternateTitles: ['Narrative'],
          alternateTopics: ['Writing', 'Algebra'],
        }),
      ],
      assignments: [
        { assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: null, topicId: null },
      ],
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
    });

    await performLinkFlow(dialog);

    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(1);
    });

    const upsertPayload = vi.mocked(upsertAssignmentDefinition).mock.calls[0][0];
    // alternateTitles should contain the deduplicated union
    expect(upsertPayload.alternateTitles).toEqual(
      expect.arrayContaining(['Essay'])
    );
    // alternateTopics should be the unchanged existing array (NOT [])
    expect(upsertPayload.alternateTopics).toEqual(['Writing', 'Algebra']);
  });

  it('post-link: success Alert replaces the body, Close button replaces the footer', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: null,
      startRunType: 'resolve',
    });

    await performLinkFlow(dialog);

    // Success alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/assessment started for/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Footer should show Close only
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(within(footer!).queryByRole('button', { name: 'Cancel' })).toBeNull();
    });
  });

  it('post-link: cache invalidation on upsert failure', async () => {
    const { dialog, queryClient } = renderWithNoMatchCache({
      upsertResult: new Error('Upsert failed'),
      upsertType: 'reject',
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await performLinkFlow(dialog);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.assignmentDefinitionPartials(),
      });
    });
  });

  it('post-link: error Alert replaces the body, Cancel button closes the modal', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: new Error('Upsert failed'),
      upsertType: 'reject',
    });

    await performLinkFlow(dialog);

    // Error Alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toContain('Upsert failed');
    expect(alert).toHaveTextContent('An error occurred. Please try again.');

    // Footer should have Cancel only (modal stays open)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('post-link: startAssessmentRun failure after a successful upsert (non-DEFINITION_STALE error)', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: new Error('Assessment run failed'),
      startRunType: 'reject',
    });

    await performLinkFlow(dialog);

    // Error Alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toContain('Assessment run failed');
    expect(alert).toHaveTextContent(
      'Link was committed but assessment could not be started: An error occurred. Please try again.'
    );

    // Modal does not close — Cancel button still present
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('link-flow DEFINITION_STALE preserves the committed link and enters recovery routing instead of the create path', async () => {
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: staleError,
      startRunType: 'reject',
    });

    await performLinkFlow(dialog);

    // The link upsert committed before the stale rejection, so it is preserved.
    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledTimes(1);
    });

    // RED: link-flow DEFINITION_STALE must enter the assessment orchestration
    // recovery routing, never the genuine create path, so the in-modal create
    // content stays unmounted.
    expect(within(dialog).queryByRole('textbox', { name: /reference document url/i })).toBeNull();
  });

  it('link-flow recovery cancellation returns to assignment selection rather than the link picker', async () => {
    vi.mocked(getAssignmentDefinition).mockResolvedValue(DEFAULT_UPSERT_RESULT);
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: staleError,
      startRunType: 'reject',
    });

    await performLinkFlow(dialog);
    await within(dialog).findByRole('button', { name: 'Update' });
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));
    await within(dialog).findByRole('button', { name: 'Cancel' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await within(dialog).findByTestId('assignment-select');
    expect(within(dialog).queryByRole('button', { name: 'Link' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })).toBeNull();
  });

  it('hasLinkSucceeded flag management', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: new Error('Assessment run failed'),
      startRunType: 'reject',
    });

    await performLinkFlow(dialog);

    // After upsert resolves but startAssessmentRun fails,
    // hasLinkSucceeded should be true, so the error Alert should
    // mention that the link was committed.
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/link was committed/i);
  });

  it('state reset on modal reopen', async () => {
    const onClose = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(upsertAssignmentDefinition).mockImplementation(() => Promise.resolve(DEFAULT_UPSERT_RESULT as any));

    const { queryClient } = renderWithNoMatchCache({ onClose });
    cleanup();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Try to reach linking state
    await clickLinkToExisting(dialog);

    // Close the modal
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false, onClose })} />
      </QueryClientProvider>
    );

    // Reopen with the same classId
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });

    // noMatchResolution should be 'idle', so choice prompt is NOT shown
    // and the assignment Select IS shown
    await within(reopenedDialog).findByRole('combobox');
    expect(within(reopenedDialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
  });

  it('state reset on Cancel from picker', async () => {
    const onClose = vi.fn();
    const { dialog } = renderWithNoMatchCache({ onClose });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    // Click Cancel in the picker footer — should return to choice, not close modal
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // noMatchResolution returns to 'choice' — choice buttons reappear
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();
    });

    // The picker is no longer visible — in choice state there are no comboboxes
    // (the assignment Select is hidden during choice/linking).
    expect(within(dialog).queryByRole('combobox')).toBeNull();
  });

  it('link flow: clicking Cancel during upsert loading closes the modal', async () => {
    const onClose = vi.fn();

    // Use a pending promise so upsert stays in loading state.
    // Must be set before renderWithNoMatchCache so the mock is not overwritten.
    const pendingUpsert = new Promise<typeof DEFAULT_UPSERT_RESULT>(() => {});
    vi.mocked(upsertAssignmentDefinition).mockReturnValue(pendingUpsert);

    const { dialog } = renderWithNoMatchCache({ onClose });

    await performLinkFlow(dialog);

    // During loading, click Cancel — should close the modal
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hasLinkSucceeded === false: error Alert shown without "link was committed" text, Cancel button present', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: new Error('Upsert failed'),
      upsertType: 'reject',
    });

    await performLinkFlow(dialog);

    // Error Alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert should NOT mention the link was committed (hasLinkSucceeded === false)
    expect(alert).not.toHaveTextContent(/link was committed/i);

    // Footer should have Cancel button (modal stays open, teacher can retry)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('linkableDefinitions recomputes when assignmentDefinitionPartials cache updates while the modal is open', async () => {
    const { dialog, queryClient } = renderWithNoMatchCache({
      definitionPartials: [],
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // The choice prompt should be visible and the Link button disabled because
    // linkableDefinitions is empty (no definitions for year-10 in the cache)
    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeDisabled();

    // Update the cache with a matching definition partial for the class's year group
    queryClient.setQueryData(
      queryKeys.assignmentDefinitionPartials(),
      [createDefinitionPartial({ yearGroupKey: 'year-10' })]
    );

    // The Link to Existing Definition button should become enabled because the
    // linkableDefinitions memo should recompute when the cache data updates.
    // THIS EXPECTATION WILL FAIL due to the known bug (C3): the memo's
    // dependency array does not include the cache data, so the memo does not
    // recompute and linkableDefinitions remains the stale empty array.
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Link to Existing Definition' })).toBeEnabled();
    });
  });
});
