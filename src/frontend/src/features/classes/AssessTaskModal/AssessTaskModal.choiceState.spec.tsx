import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '@/services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import type { StartAssessmentRunResponse } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { queryKeys } from '@/query/queryKeys';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { createAppQueryClient } from '@/query/queryClient';
import { createFixtureClassPartial } from '@/test/classes/classesPageTestHelpers';
import {
  MOCK_CLASS_ID,
  MOCK_ASSIGNMENTS,
  MODAL_TITLE,
  defaultProperties,
  renderWithCache,
  selectAssignment,
  clickStartAssessment,
  clickCreateNewDefinition,
  expectCancelButtonPresent,
} from '@/test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '@/test/classes/AssessTaskModal.link-flow-helpers';
import { createDefinitionPartial } from '@/test/classes/matchDefinitionForAssignment.test-utilities';
import { getAssignmentTopics } from '@/services/assignmentDefinition/assignmentTopicsService';
import { getYearGroups } from '@/services/referenceData/referenceDataService';

/** Minimal valid response used by the assessment-start mocks. */
const START_ASSESSMENT_RUN_RESPONSE: StartAssessmentRunResponse = { requestId: 'test-run-id' };

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
 * Renders a no-match choice state, closes the modal, and reopens it with the
 * same classId.  Used by the reopen/reset tests to verify state is cleared.
 *
 * @returns {Promise<{ dialog: HTMLElement }>} The reopened dialog element.
 */
async function setupReopenInPlace() {
  const onClose = vi.fn();

  // Use renderWithNoMatchCache to set up mocks and create a populated query client
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

  return { dialog: await screen.findByRole('dialog', { name: MODAL_TITLE }) };
}

// ---------------------------------------------------------------------------
// No-match resolution — choice state
// ---------------------------------------------------------------------------

describe('No-match resolution — choice state', () => {
  it('shows choice prompt with Alert, Create New Definition button, and enabled Link to Existing button when findMatchingDefinition returns no-match', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // An info Alert should explain the no-match situation
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/no matching assignment definition found/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Two choice buttons should be visible
    expect(
      within(dialog).getByRole('button', { name: 'Create New Definition' })
    ).toBeInTheDocument();

    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toBeEnabled();
  });

  it('hides assignment Select and shows only Cancel in footer during choice state', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Assignment Select should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    // Footer should only have Cancel (no Start Assessment)
    expectCancelButtonPresent(dialog);
    expect(within(dialog).queryByRole('button', { name: /start assessment/i })).toBeNull();
  });

  it('transitions to creating state when Create New Definition is clicked', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Click "Create New Definition" — this should transition to 'creating'
    await clickCreateNewDefinition(dialog);

    // Once in creating state, the choice buttons should be gone
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
    });

    // The choice prompt Alert should also be gone — body content changed from choice to creating
    expect(within(dialog).queryByText(/no matching assignment definition found/i)).toBeNull();

    // The assignment Select remains hidden (was hidden in choice, stays hidden in creating).
    // The stage-one wizard content renders in-modal instead.
    expect(within(dialog).queryByTestId('assignment-select')).toBeNull();
    expect(
      await within(dialog).findByRole('textbox', { name: /reference document url/i })
    ).toBeInTheDocument();
  });

  it('shows Link to Existing button disabled with Tooltip when no linkable definitions exist', async () => {
    const { dialog } = renderWithNoMatchCache({ definitionPartials: [] });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeDisabled();

    // Hover over the button wrapper to trigger the Tooltip
    const buttonParent = linkButton.parentElement;
    if (buttonParent) {
      fireEvent.pointerEnter(buttonParent);
    }

    // Tooltip should explain why the button is disabled
    await screen.findByText("No assignment definitions exist for this class's year group.");
  });

  it('reopens modal and resets noMatchResolution to idle', async () => {
    const { dialog: reopenedDialog } = await setupReopenInPlace();
    await within(reopenedDialog).findByRole('combobox');

    // noMatchResolution should be reset to 'idle', so choice prompt is NOT shown
    expect(
      within(reopenedDialog).queryByRole('button', { name: 'Create New Definition' })
    ).toBeNull();
  });

  it('reopens modal and resets assessmentState to idle', async () => {
    const { dialog: reopenedDialog } = await setupReopenInPlace();

    // assessmentState should be 'idle', so Select is visible and no Alert
    await within(reopenedDialog).findByRole('combobox');
    expect(within(reopenedDialog).queryByRole('alert')).toBeNull();
  });

  it('initial noMatchResolution is idle — matched flow succeeds without choice prompt', async () => {
    const matchedDefinition = createDefinitionPartial();
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: START_ASSESSMENT_RUN_RESPONSE,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // The choice prompt must NOT appear — confirming noMatchResolution starts as 'idle'.
    // If noMatchResolution were 'choice', the choice prompt would render instead of
    // the normal success flow after a matched definition is found.
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
      expect(
        within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })
      ).toBeNull();
      expect(within(dialog).queryByText(/no matching assignment definition found/i)).toBeNull();
    });

    // Success state should appear (standard matched flow)
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Success state: Close button behaviour
// ---------------------------------------------------------------------------

describe('Success state close', () => {
  it('calls onClose when Close button is clicked in success state', async () => {
    const matchedDefinition = createDefinitionPartial();
    const onClose = vi.fn();

    vi.mocked(getGoogleClassroomAssignments).mockImplementation(() =>
      Promise.resolve(MOCK_ASSIGNMENTS)
    );

    vi.mocked(findMatchingDefinition).mockReturnValue({
      kind: 'matched',
      definition: matchedDefinition,
    });
    vi.mocked(startAssessmentRun).mockImplementation(() =>
      Promise.resolve(START_ASSESSMENT_RUN_RESPONSE)
    );

    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.classPartials(), [
      createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
    ]);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [matchedDefinition]);

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />, {
      queryClient,
    });

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    await clickStartAssessment(dialog);

    // Wait for success state — find the Close button in the footer
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    const closeButton = await within(footer!).findByRole('button', { name: 'Close' });

    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
