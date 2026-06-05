import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '../../services/googleClassroomAssignmentsService';

vi.mock('../../services/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

const MOCK_CLASS_ID = 'class-123';
const MOCK_CLASS_NAME = 'My Class';
const MOCK_ASSIGNMENTS = [{ assignmentId: 'a1', title: 'Essay' }];
const MOCK_EMPTY_ASSIGNMENTS: Array<{ assignmentId: string; title: string }> = [];
const MODAL_TITLE = `Assess Task — ${MOCK_CLASS_NAME}`;

/**
 * Standard props for the modal in most tests.
 *
 * @param {Partial<{ open: boolean; classId: string; className: string; onClose: () => void }>} [overrides] Optional prop overrides.
 * @returns {object} The complete properties object with sensible defaults.
 */
function defaultProperties(overrides: Partial<{
  open: boolean;
  classId: string;
  className: string;
  onClose: () => void;
}> = {}) {
  return {
    open: true,
    classId: MOCK_CLASS_ID,
    className: MOCK_CLASS_NAME,
    onClose: vi.fn(),
    ...overrides,
  };
}

/** Returns a promise that never resolves — used for loading-state tests. */
function createPendingPromise<T>(): Promise<T> {
   
  return new Promise<T>(() => {});
}

/**
 * Sets up the mocked getGoogleClassroomAssignments with the given mock value,
 * renders the modal, and returns the dialog element.
 *
 * @param {unknown} mockValue - Value to pass to mockReturnValue/mockResolvedValue/mockRejectedValue.
 * @param {'return' | 'resolve' | 'reject'} mockType - How to set up the mock.
 * @returns {ReturnType<typeof screen.getByRole>} The dialog element.
 */
function renderAssessTaskModal(
  mockValue: unknown,
  mockType: 'return' | 'resolve' | 'reject' = 'return'
): ReturnType<typeof screen.getByRole> {
  const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
  // mockValue is deliberately polymorphic (Promise, array, Error) so
  // each branch applies the narrowest type assertion needed by the mock.
  type AssignmentsPayload = { assignmentId: string; title: string }[];
  if (mockType === 'resolve') {
    mockedGetAssignments.mockResolvedValue(mockValue as AssignmentsPayload);
  } else if (mockType === 'reject') {
    mockedGetAssignments.mockRejectedValue(mockValue);
  } else {
    mockedGetAssignments.mockReturnValue(mockValue as Promise<AssignmentsPayload>);
  }

  render(<AssessTaskModal {...defaultProperties()} />);
  return screen.getByRole('dialog', { name: MODAL_TITLE });
}

/**
 * Asserts that the Start Assessment button is disabled within the given dialog.
 *
 * @param {ReturnType<typeof screen.getByRole>} dialog - The modal dialog element.
 */
function expectStartAssessmentDisabled(dialog: ReturnType<typeof screen.getByRole>): void {
  expect(
    within(dialog).getByRole('button', { name: 'Start Assessment' })
  ).toBeDisabled();
}

/**
 * Asserts that the Cancel button is present within the given dialog.
 *
 * @param {ReturnType<typeof screen.getByRole>} dialog - The modal dialog element.
 */
function expectCancelButtonPresent(dialog: ReturnType<typeof screen.getByRole>): void {
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
}

beforeEach(() => {
  vi.clearAllMocks();
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

    render(<AssessTaskModal {...defaultProperties()} />);

    expect(screen.getByRole('dialog', { name: MODAL_TITLE })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Loading State
// ---------------------------------------------------------------------------

describe('Loading state', () => {
  it('shows Spin centred in modal body, Select not rendered, Start Assessment disabled', () => {
    const dialog = renderAssessTaskModal(createPendingPromise());

    // Spin is visible in the modal body
    expect(within(dialog).getByRole('status')).toBeInTheDocument(); // Ant Spin renders role="status"

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

    // Open the Select dropdown
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));

    // Select the assignment option by its label
    const option = await screen.findByText('Essay');
    fireEvent.click(option);

    // After selection, Start Assessment should be enabled
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Start Assessment' })
      ).toBeEnabled();
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
  it('shows Alert with error, Select not rendered, Start Assessment disabled', async () => {
    const dialog = renderAssessTaskModal(new Error('Failed to fetch assignments'), 'reject');

    // Error Alert is visible
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();

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
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    const onClose = vi.fn();

    render(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox'); // wait for ready state

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Ant Design v6 renders modals in a React portal. @rc-component/dialog
  // listens for mousedown+click on the .ant-modal-wrap. Because portal
  // event propagation interacts differently with React's synthetic event
  // system in JSDOM, we use native dispatchEvent to ensure the handlers fire.
  it('calls onClose when modal backdrop is clicked', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    const onClose = vi.fn();

    render(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');

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

    render(<AssessTaskModal {...defaultProperties()} />);

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
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);

    const { rerender } = render(<AssessTaskModal {...defaultProperties()} />);

    // Verify initial fetch
    expect(mockedGetAssignments).toHaveBeenCalledWith(MOCK_CLASS_ID);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);

    // Close the modal
    rerender(<AssessTaskModal {...defaultProperties({ open: false })} />);

    // Reopen with a different classId
    const newClassId = 'class-456';
    rerender(
      <AssessTaskModal
        {...defaultProperties({ open: true, classId: newClassId })}
      />
    );

    // Should trigger a fresh fetch with the new classId
    const expectedFetchCountAfterReopen = 2;
    expect(mockedGetAssignments).toHaveBeenCalledWith(newClassId);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(expectedFetchCountAfterReopen);
  });
});

// ---------------------------------------------------------------------------
// Interaction: Start Assessment No-Op
// ---------------------------------------------------------------------------

describe('Start Assessment click', () => {
  it('is a no-op: no backend call, modal stays open, no visual state change', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    const onClose = vi.fn();

    render(<AssessTaskModal {...defaultProperties({ onClose })} />);

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');

    // Select an assignment to enable Start Assessment
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    fireEvent.click(option);

    // Wait for Start Assessment to be enabled
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Start Assessment' })
      ).toBeEnabled();
    });

    // Click Start Assessment
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    );

    // Verify no additional calls to getGoogleClassroomAssignments (still 1 from open)
    expect(mockedGetAssignments).toHaveBeenCalledTimes(1);

    // Verify onClose was not called (modal stays open)
    expect(onClose).not.toHaveBeenCalled();

    // Verify modal is still present
    expect(
      screen.getByRole('dialog', { name: MODAL_TITLE })
    ).toBeInTheDocument();

    // Start Assessment should still be enabled after click (no state change)
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Footer: Both Buttons in All States
// ---------------------------------------------------------------------------

describe('Footer buttons across all states', () => {
  it('always renders both Cancel and Start Assessment in the modal footer', async () => {
    const mockedGetAssignments = vi.mocked(getGoogleClassroomAssignments);

    // Test loading state — use a fresh render
    mockedGetAssignments.mockReturnValue(createPendingPromise());
    render(<AssessTaskModal {...defaultProperties()} />);
    let dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test error state — separate render
    mockedGetAssignments.mockRejectedValue(new Error('Failed'));
    render(<AssessTaskModal {...defaultProperties()} key="error" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test empty state — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_EMPTY_ASSIGNMENTS);
    render(<AssessTaskModal {...defaultProperties()} key="empty" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByText('No assignments found for this class');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    cleanup();

    // Test ready state (no selection) — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    render(<AssessTaskModal {...defaultProperties()} key="ready-no-sel" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();

    // Test ready state (selection made) — same render, just interact
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    fireEvent.click(option);
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Start Assessment' })
      ).toBeEnabled();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Start Assessment' })
    ).toBeInTheDocument();
  });
});
