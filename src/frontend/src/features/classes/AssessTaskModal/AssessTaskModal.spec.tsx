import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/test/classes/AssessTaskModal.mockSetup';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '@/services/googleClassrooms/googleClassroomAssignmentsService';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { createAppQueryClient } from '@/query/queryClient';
import type { GoogleClassroomAssignmentsResponse } from '@/services/googleClassrooms/googleClassroomAssignments.zod';
import {
  MOCK_CLASS_ID,
  MOCK_ASSIGNMENTS,
  MOCK_EMPTY_ASSIGNMENTS,
  MODAL_TITLE,
  defaultProperties,
  createPendingPromise,
  renderAssessTaskModal,
  expectStartAssessmentDisabled,
  expectCancelButtonPresent,
} from '@/test/classes/AssessTaskModal.test-utilities';
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
// Modal Shell
// ---------------------------------------------------------------------------

describe('AssessTaskModal shell', () => {
  it('renders with correct title including className', () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockReturnValue(createPendingPromise());

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);

    expect(screen.getByRole('dialog', { name: MODAL_TITLE })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading State
// ---------------------------------------------------------------------------

describe('Loading state', () => {
  it('shows loading skeleton in modal body, Select not rendered, Start Assessment disabled', () => {
    const dialog = renderAssessTaskModal(createPendingPromise());

    // Skeleton is visible in the modal body
    expect(within(dialog).getByRole('status')).toHaveAttribute('aria-busy', 'true');

    // Select (combobox) is not rendered while loading
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Ready State (no selection)
// ---------------------------------------------------------------------------

describe('Ready state (no selection)', () => {
  it('shows Select with placeholder, Start Assessment disabled, and Select label', async () => {
    const dialog = renderAssessTaskModal(MOCK_ASSIGNMENTS, 'resolve');

    // Wait for Select (combobox) to appear after fetch resolves
    const select = await within(dialog).findByRole('combobox');
    expect(select).toBeInTheDocument();

    // antd v6 places role="combobox" on a void <input> element
    // (no textContent, no placeholder attribute). The placeholder
    // text is rendered as a visible span, so find it via getByText.
    expect(within(dialog).getByText('Select an assignment')).toBeInTheDocument();

    // "Select assignment" label is visible above the Select
    expect(within(dialog).getByText('Select assignment')).toBeInTheDocument();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Ready State (selection made)
// ---------------------------------------------------------------------------

describe('Ready state (selection made)', () => {
  it('enables Start Assessment and shows confirmation text when an assignment is selected', async () => {
    const dialog = renderAssessTaskModal(MOCK_ASSIGNMENTS, 'resolve');

    // Wait for the Select to appear
    await within(dialog).findByRole('combobox');

    // Open the Select dropdown and select the assignment option
    await user.click(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    await user.click(option);

    // After selection, Start Assessment should be enabled
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
    });

    // antd v6 renders the selected value in multiple DOM locations
    // (aria-live span, Select display, etc.). Use getAllByText and
    // verify at least one match exists.
    const essayMatches = within(dialog).getAllByText('Essay');
    expect(essayMatches.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

describe('Empty state', () => {
  it('shows Empty component with message and disabled Start Assessment', async () => {
    const dialog = renderAssessTaskModal(MOCK_EMPTY_ASSIGNMENTS, 'resolve');

    // Empty component message
    expect(
      await within(dialog).findByText('No assignments found for this class')
    ).toBeInTheDocument();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Error State
// ---------------------------------------------------------------------------

describe('Error state', () => {
  it('shows mapped error copy when assignment fetching fails', async () => {
    const rawErrorMessage = 'Assignment service implementation detail';
    const dialog = renderAssessTaskModal(new Error(rawErrorMessage), 'reject');

    // Error Alert is visible
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('An error occurred. Please try again.');
    expect(alert).not.toHaveTextContent(rawErrorMessage);

    // Select (combobox) is not rendered in error state
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    expectStartAssessmentDisabled(dialog);
    expectCancelButtonPresent(dialog);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Cancel and Mask Click
// ---------------------------------------------------------------------------

describe('Cancel and close', () => {
  it('calls onClose when Cancel button is clicked', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockImplementation(() => Promise.resolve(MOCK_ASSIGNMENTS));
    const onClose = vi.fn();

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox'); // wait for ready state

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Ant Design v6 renders modals in a React portal. @rc-component/dialog
  // listens for mousedown+click on the .ant-modal-wrap. Because portal
  // event propagation interacts differently with React's synthetic event
  // system in JSDOM, we use native dispatchEvent to ensure the handlers fire.
  it('calls onClose when modal backdrop is clicked', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockImplementation(() => Promise.resolve(MOCK_ASSIGNMENTS));
    const onClose = vi.fn();

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByTestId('assignment-select');

    const wrap = dialog.closest('.ant-modal-wrap');
    expect(wrap).not.toBeNull();

    await act(async () => {
      wrap!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      wrap!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      wrap!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Fetch on Open
// ---------------------------------------------------------------------------

describe('Fetch on open', () => {
  it('calls getGoogleClassroomAssignments with classId when modal opens', () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockReturnValue(createPendingPromise());

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);

    expect(mockedGetAssignments).toHaveBeenCalledWith(MOCK_CLASS_ID);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Reopen Resets State
// ---------------------------------------------------------------------------

describe('Reopen resets state', () => {
  it('triggers fresh fetch with new classId when modal reopens for a different class', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockImplementation(() => Promise.resolve(MOCK_ASSIGNMENTS));

    const queryClient = createAppQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties()} />
      </QueryClientProvider>
    );

    // Verify initial fetch
    expect(mockedGetAssignments).toHaveBeenCalledWith(MOCK_CLASS_ID);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);

    // Close the modal
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <AssessTaskModal {...defaultProperties({ open: false })} />
        </QueryClientProvider>
      );
    });

    // Reopen with a different classId
    const newClassId = 'class-456';
    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <AssessTaskModal {...defaultProperties({ open: true, classId: newClassId })} />
        </QueryClientProvider>
      );
    });

    // Should trigger a fresh fetch with the new classId
    const expectedFetchCountAfterReopen = 2;
    expect(mockedGetAssignments).toHaveBeenCalledWith(newClassId);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(expectedFetchCountAfterReopen);
  });
});

// ---------------------------------------------------------------------------
// Cleanup on close
// ---------------------------------------------------------------------------

describe('Cleanup on close', () => {
  it('closing the modal mid-fetch does not apply the stale result to state', async () => {
    // Create a deferred promise for the first fetch so we can control
    // when it resolves (after the modal is closed).
    const { promise: firstDeferred, resolve: resolveFirstFetch } =
      Promise.withResolvers<GoogleClassroomAssignmentsResponse>();

    // Second fetch stays pending so we can observe the state before it resolves.
    const secondDeferred = new Promise<GoogleClassroomAssignmentsResponse>(() => {});

    vi.mocked(getGoogleClassroomAssignments)
      .mockReturnValueOnce(firstDeferred)
      .mockReturnValueOnce(secondDeferred);

    // Stale data that must NOT leak into the visible state after re-opening
    const staleData: GoogleClassroomAssignmentsResponse = [
      { assignmentId: 'stale-1', title: 'Stale Assignment', creationTime: '2024-09-01T08:00:00.000Z', topicName: 'Old Topic', topicId: null },
    ];

    const queryClient = createAppQueryClient();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties()} />
      </QueryClientProvider>
    );

    // Modal is open — effect fires, fetch starts, loading skeleton visible
    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    expect(within(dialog).getByRole('status')).toBeInTheDocument();

    // Close the modal while the first fetch is still in-flight
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false })} />
      </QueryClientProvider>
    );

    // Resolve the first fetch with stale data — the leaky .then() fires
    // while the modal is closed, updating component state.
    await act(async () => {
      resolveFirstFetch(staleData);
    });

    // Re-open the modal — this triggers the useEffect again, starting a
    // second fetch via the second mock call (secondDeferred, pending).
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties()} />
      </QueryClientProvider>
    );

    const reopenedDialog = await screen.findByRole('dialog', { name: MODAL_TITLE });

    // Assert: the stale data does NOT leak into the visible state.
    //
    // BUG (no cleanup): the leaky .then() handler set fetchState to 'ready'
    //   and assignments to staleData. After re-opening, the modal shows the
    //   stale assignments (combobox visible, no loading skeleton).
    //
    // FIX (with cleanup): the stale handler was suppressed by the cleanup
    //   function. fetchState remains 'loading'. The modal shows the loading
    //   skeleton while the second fetch is pending.
    expect(within(reopenedDialog).getByRole('status')).toBeInTheDocument();
  });
});
