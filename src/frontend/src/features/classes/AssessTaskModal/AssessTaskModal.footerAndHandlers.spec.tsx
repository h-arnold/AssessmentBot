import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '@/services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '@/services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '@/services/assignmentDefinition/assignmentDefinitionService';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import {
  MOCK_ASSIGNMENTS,
  MOCK_EMPTY_ASSIGNMENTS,
  MOCK_CLASS_ID,
  MODAL_TITLE,
  DEFAULT_UPSERT_RESULT,
  START_ASSESSMENT_RUN_RESPONSE,
  defaultProperties,
  createPendingPromise,
  resetAssessTaskModalMocks,
} from '@/test/classes/AssessTaskModal.test-utilities';
import { renderWithNoMatchCache } from '@/test/classes/AssessTaskModal.link-flow-helpers';

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  resetAssessTaskModalMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ---------------------------------------------------------------------------
// Footer: Buttons in Non-Success States
// ---------------------------------------------------------------------------

describe('Footer buttons across states', () => {
  it('renders Cancel and Start Assessment in loading, error, empty, and ready states', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);

    // Test loading state — use a fresh render
    mockedGetAssignments.mockReturnValue(createPendingPromise());
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);
    let dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test error state — separate render
    mockedGetAssignments.mockRejectedValue(new Error('Failed'));
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="error" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test empty state — separate render
    mockedGetAssignments.mockImplementation(() => Promise.resolve(MOCK_EMPTY_ASSIGNMENTS));
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="empty" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByText('No assignments found for this class');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test ready state (no selection) — separate render
    mockedGetAssignments.mockImplementation(() => Promise.resolve(MOCK_ASSIGNMENTS));
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="ready-no-sel" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    // Test ready state (selection made) — same render, just interact
    await user.click(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    await user.click(option);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Inline Event Handler Stability
// ---------------------------------------------------------------------------

describe('Inline event handler stability', () => {
  it('inline event handlers trigger the expected side effects after stabilisation', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: START_ASSESSMENT_RUN_RESPONSE,
      startRunType: 'resolve',
    });

    // Handler 1: Assignment Select onChange — selects an assignment
    // Side effect: selectedAssignmentId is set, enabling Start Assessment
    await within(dialog).findByRole('combobox');
    await user.click(within(dialog).getByRole('combobox'));
    const essayOption = await screen.findByText('Essay');
    await user.click(essayOption);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
    });

    // Handler 2: Start Assessment button onClick — triggers the no-match flow
    // Side effect: assessment state transitions to no-match and choice prompt appears
    await user.click(within(dialog).getByRole('button', { name: 'Start Assessment' }));
    await within(dialog).findByRole('button', { name: 'Link to Existing Definition' });

    // Navigate to the linking state
    await user.click(within(dialog).getByRole('button', { name: 'Link to Existing Definition' }));

    // Handler 3: Linkable definition Select onSelect — selects a definition row
    // Side effect: selectedDefinitionForLink is set, enabling the Link button
    const linkableSelect = within(dialog).getByRole('combobox');
    await user.click(linkableSelect);
    const definitionOption = await screen.findByText('Essay');
    await user.click(definitionOption);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Link' })).toBeEnabled();
    });

    // Handler 4: Link button onClick — triggers the link-upsert and assessment run
    // Side effect: upsertAssignmentDefinition and startAssessmentRun are called
    await user.click(within(dialog).getByRole('button', { name: 'Link' }));
    await waitFor(() => {
      expect(vi.mocked(upsertAssignmentDefinition)).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledWith({
        definitionKey: 'essay-def-key',
        assignmentId: 'a1',
        courseId: MOCK_CLASS_ID,
      });
    });
  });
});
