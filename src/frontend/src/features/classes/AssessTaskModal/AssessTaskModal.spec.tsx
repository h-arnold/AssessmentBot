import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssessTaskModal } from './AssessTaskModal';
import { getGoogleClassroomAssignments } from '../../../services/googleClassrooms/googleClassroomAssignmentsService';
import { startAssessmentRun } from '../../../services/assignmentAssessment/assignmentAssessmentService';
import { upsertAssignmentDefinition } from '../../../services/assignmentDefinition/assignmentDefinitionService';
import { findMatchingDefinition } from './matchDefinitionForAssignment';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';
import { createAppQueryClient } from '../../../query/queryClient';
import { ApiTransportError } from '../../../errors/apiTransportError';
import { createFixtureClassPartial } from '../../../test/classes/classesPageTestHelpers';
import type { AssignmentTopic } from '../../../services/referenceData/referenceData.zod';
import {
  type RenderWithCacheOptions,
  MOCK_CLASS_ID,
  MOCK_ASSIGNMENTS,
  MOCK_EMPTY_ASSIGNMENTS,
  MODAL_TITLE,
  DEFAULT_UPSERT_RESULT,
  defaultProperties,
  createPendingPromise,
  renderAssessTaskModal,
  renderWithCache,
  selectAssignment,
  clickStartAssessment,
  clickCreateNewDefinition,
  clickLinkToExisting,
  expectLinkButtonDisabled,
  getWizardProperties,
  expectStartAssessmentDisabled,
  expectCancelButtonPresent,
} from '../../../test/classes/AssessTaskModal.test-utilities';
import {
  renderWithNoMatchCache,
  performLinkFlow,
} from '../../../test/classes/AssessTaskModal.link-flow-helpers';
import { createDefinitionPartial } from '../../../test/classes/matchDefinitionForAssignment.test-utilities';

vi.mock('../../../services/googleClassrooms/googleClassroomAssignmentsService', () => ({
  getGoogleClassroomAssignments: vi.fn(),
}));

vi.mock('../../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  startAssessmentRun: vi.fn(),
}));

vi.mock('../../../services/assignmentDefinition/assignmentDefinitionService', () => ({
  upsertAssignmentDefinition: vi.fn(),
}));

vi.mock('./matchDefinitionForAssignment', () => ({
  findMatchingDefinition: vi.fn(),
}));

/**
 * Removes function values from an object, replacing them with a marker,
 * so the remaining object can be safely JSON-serialized.
 *
 * @param {Record<string, unknown>} object The object to clean.
 * @returns {Record<string, unknown>} A new object with functions removed.
 */
function stripFunctions(object: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(object)) {
    if (typeof value !== 'function') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

vi.mock('../../assignmentWizard/AssignmentDefinitionWizardModal', () => ({
  AssignmentDefinitionWizardModal: vi.fn((properties: Record<string, unknown>) => {
    // Store ALL props (including functions) on the element via ref
    // so tests can access function references directly.
    const elementReference = (element: HTMLDivElement | null) => {
      if (element) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (element as any).__wizardProps = properties;
      }
    };

    return (
      <div
        ref={elementReference}
        data-testid="wizard-mock"
        data-props={JSON.stringify(stripFunctions(properties))}
      />
    );
  }),
}));

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

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} />);

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

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

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

    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties({ onClose })} />);

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
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);

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
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: false })} />
      </QueryClientProvider>
    );

    // Reopen with a different classId
    const newClassId = 'class-456';
    rerender(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ open: true, classId: newClassId })} />
      </QueryClientProvider>
    );

    // Should trigger a fresh fetch with the new classId
    const expectedFetchCountAfterReopen = 2;
    expect(mockedGetAssignments).toHaveBeenCalledWith(newClassId);
    expect(mockedGetAssignments).toHaveBeenCalledTimes(expectedFetchCountAfterReopen);
  });
});

// ---------------------------------------------------------------------------
// Assessment Run Interaction
// ---------------------------------------------------------------------------

describe('Assessment run interaction', () => {
  // -----------------------------------------------------------------------
  // Cache miss cases
  // -----------------------------------------------------------------------

  it('shows error Alert when classPartials cache is empty', async () => {
    const { dialog } = renderWithCache({
      classPartials: undefined,
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('shows error Alert with specific message when classId is not found in cached classPartials', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: 'other-class', yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Class not found in cached data');
  });

  it('shows error Alert when assignmentDefinitionPartials cache is empty', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: undefined,
      findMatchResult: { kind: 'matched', definition: createDefinitionPartial() },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Null topic / null year group
  // -----------------------------------------------------------------------

  it('shows no-match error Alert when assignment has null topicName', async () => {
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [createDefinitionPartial()],
      // findMatchResult is intentionally omitted: the component returns early
      // before findMatchingDefinition is called because topicName is null.
      assignments: [{ assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: null, topicId: null }],
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert should indicate this assignment cannot be assessed because
    // it has no topic set in Google Classroom.
    expect(alert).toHaveTextContent(/no.*topic|topic.*null|no.*match/i);
  });

  it('shows error Alert with specific message when class has null yearGroupKey', async () => {
    const { dialog } = renderWithNoMatchCache({
      classPartials: [createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: null })],
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Cannot determine year group for this class');
  });

  // -----------------------------------------------------------------------
  // Match results
  // -----------------------------------------------------------------------

  it('shows error Alert when findMatchingDefinition returns ambiguous match', async () => {
    const definitionOne = createDefinitionPartial({ definitionKey: 'def-1' });
    const definitionTwo = createDefinitionPartial({ definitionKey: 'def-2' });

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [definitionOne, definitionTwo],
      findMatchResult: { kind: 'ambiguous', matches: [definitionOne, definitionTwo] },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // API call results
  // -----------------------------------------------------------------------

  it('shows success Alert and single Close button when match + API succeeds', async () => {
    const matchedDefinition = createDefinitionPartial();
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Success alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();

    // Footer should have only Close button (no Cancel or Start Assessment)
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Start Assessment' })).toBeNull();
    });

    // Scope Close button query to footer to avoid clashing with the modal's
    // built-in X close button which also has accessible name "Close".
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows warning Alert when startAssessmentRun rejects with DefinitionStaleError', async () => {
    const matchedDefinition = createDefinitionPartial();
    const staleError = new ApiTransportError({
      requestId: 'test-id',
      error: { code: 'DEFINITION_STALE', message: 'Definition is stale' },
    });

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: staleError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  it('shows error Alert when startAssessmentRun rejects with generic API error', async () => {
    const matchedDefinition = createDefinitionPartial();
    const genericError = new Error('Something went wrong');

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: genericError,
      startRunType: 'reject',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    await expect(within(dialog).findByRole('alert')).resolves.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Loading state during API call
  // -----------------------------------------------------------------------

  it('shows loading on Start Assessment button during API call, reverts on completion', async () => {
    const matchedDefinition = createDefinitionPartial();
    let resolveRun!: (value: null) => void;
    const pendingRun = new Promise<null>((resolve) => {
      resolveRun = resolve;
    });
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // During API call, button should show loading state.
    // Ant Design appends "loading" to the accessible name when loading.
    const button = within(dialog).getByRole('button', { name: 'loading Start Assessment' });
    expect(button).toBeDisabled();

    // Resolve the API call
    await act(async () => {
      resolveRun(null);
    });

    // After completion, loading should be gone (success state shown)
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    await waitFor(() => {
      expect(within(footer!).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });
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
  clickStartAssessment(dialog);

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
    clickStartAssessment(dialog);

    // An info Alert should explain the no-match situation
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/no matching assignment definition found/i);
    expect(alert).toHaveTextContent(/Essay/);

    // Two choice buttons should be visible
    expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();

    const linkButton = within(dialog).getByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toBeEnabled();
  });

  it('hides assignment Select and shows only Cancel in footer during choice state', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Assignment Select should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();

    // Footer should only have Cancel (no Start Assessment)
    expectCancelButtonPresent(dialog);
    expect(within(dialog).queryByRole('button', { name: /start assessment/i })).toBeNull();
  });

  it('transitions to creating state when Create New Definition is clicked', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Click "Create New Definition" — this should transition to 'creating'
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create New Definition' }));

    // Once in creating state, the choice buttons should be gone
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
    });

    // The choice prompt Alert should also be gone — body content changed from choice to creating
    expect(within(dialog).queryByText(/no matching assignment definition found/i)).toBeNull();

    // The assignment Select remains hidden (was hidden in choice, stays hidden in creating)
    expect(within(dialog).queryByRole('combobox')).toBeNull();
  });

  it('shows Link to Existing button disabled with Tooltip when no linkable definitions exist', async () => {
    const { dialog } = renderWithNoMatchCache({ definitionPartials: [] });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

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
    expect(within(reopenedDialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
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
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // The choice prompt must NOT appear — confirming noMatchResolution starts as 'idle'.
    // If noMatchResolution were 'choice', the choice prompt would render instead of
    // the normal success flow after a matched definition is found.
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
      expect(within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })).toBeNull();
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

    vi.mocked(getGoogleClassroomAssignments).mockResolvedValue(MOCK_ASSIGNMENTS);

    vi.mocked(findMatchingDefinition).mockReturnValue({
      kind: 'matched',
      definition: matchedDefinition,
    });
    vi.mocked(startAssessmentRun).mockResolvedValue(null);

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
    clickStartAssessment(dialog);

    // Wait for success state — find the Close button in the footer
    const footer = dialog.querySelector('.ant-modal-footer') as HTMLElement | null;
    expect(footer).not.toBeNull();
    const closeButton = await within(footer!).findByRole('button', { name: 'Close' });

    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
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
    mockedGetAssignments.mockResolvedValue(MOCK_EMPTY_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="empty" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByText('No assignments found for this class');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    cleanup();

    // Test ready state (no selection) — separate render
    mockedGetAssignments.mockResolvedValue(MOCK_ASSIGNMENTS);
    renderWithFrontendProviders(<AssessTaskModal {...defaultProperties()} key="ready-no-sel" />);
    dialog = await screen.findByRole('dialog', { name: MODAL_TITLE });
    await within(dialog).findByRole('combobox');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();

    // Test ready state (selection made) — same render, just interact
    fireEvent.mouseDown(within(dialog).getByRole('combobox'));
    const option = await screen.findByText('Essay');
    fireEvent.click(option);
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeEnabled();
    });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Start Assessment' })).toBeInTheDocument();
  });
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
  clickStartAssessment(dialog);

  return { dialog, queryClient };
}

// ---------------------------------------------------------------------------
// No-match resolution — creating state and wizard integration
// ---------------------------------------------------------------------------

describe('No-match resolution — creating state and wizard integration', () => {
  it('renders wizard with mode="create" and correct initialValues when topicId matches cache', async () => {
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
    const properties = await getWizardProperties();

    expect(properties.mode).toBe('create');
    expect(properties.open).toBe(true);
    expect(properties.definitionKey).toBeNull();
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      topic: 'topic-writing',
      yearGroup: 'year-10',
    });
    expect(typeof properties.onCreateSuccess).toBe('function');
    expect(typeof properties.onClose).toBe('function');
  });

  it('leaves topic field empty when topicId is not in the assignmentTopics cache', async () => {
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
    const properties = await getWizardProperties();

    // Topic should NOT be present in initialValues when not found in cache
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      yearGroup: 'year-10',
    });
    expect(properties.initialValues.topic).toBeUndefined();
  });

  it('leaves topic field empty when topicId is null', async () => {
    const { dialog, queryClient } = await setupWizardTest({
      assignments: [{ assignmentId: 'a1', title: 'Essay', creationTime: '2024-09-02T08:30:00.000Z', topicName: 'Writing', topicId: null }],
    });

    // Populate assignmentTopics cache so the test validates the correct code path
    // — topicId is null, so topic should remain blank even when topics are cached.
    queryClient.setQueryData<AssignmentTopic[]>(queryKeys.assignmentTopics(), [
      { key: 'topic-writing', name: 'Writing', yearGroupKeys: ['year-10'] },
    ]);

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();

    // Topic should NOT be in initialValues when topicId is null
    expect(properties.initialValues).toEqual({
      title: 'Essay',
      yearGroup: 'year-10',
    });
    expect(properties.initialValues.topic).toBeUndefined();
  });

  it('calls startAssessmentRun and shows success state when wizard saves successfully', async () => {
    const { dialog } = await setupWizardTest({
      startRunResult: null,
      startRunType: 'resolve',
    });

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();
    properties.onCreateSuccess('new-def-key');

    // startAssessmentRun should have been called with the new definition key
    await waitFor(() => {
      expect(vi.mocked(startAssessmentRun)).toHaveBeenCalledWith({
        definitionKey: 'new-def-key',
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

  it('shows error state when startAssessmentRun fails after wizard creates definition', async () => {
    const apiError = new Error('API failure');
    const { dialog } = await setupWizardTest({
      startRunResult: apiError,
      startRunType: 'reject',
    });

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();
    properties.onCreateSuccess('new-def-key');

    // Error alert should appear
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('API failure');
  });

  it('returns to choice state when wizard is cancelled', async () => {
    const { dialog } = await setupWizardTest();

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();

    // Simulate wizard cancel (onClose fires without onCreateSuccess having been called)
    properties.onClose();

    // Should return to choice state — choice buttons appear again
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: 'Create New Definition' })
      ).toBeInTheDocument();
    });

    // The wizard mock should be unmounted
    expect(screen.queryByTestId('wizard-mock')).toBeNull();
  });

  it('calls modal onClose when Cancel is clicked during creating state', async () => {
    const onClose = vi.fn();
    const { dialog } = await setupWizardTest({ onClose });

    await clickCreateNewDefinition(dialog);

    // Now in creating state — click Cancel in the AssessTaskModal footer
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows correct UI during auto-assessment loading and final state after resolution', async () => {
    let resolveRun!: (value: null) => void;
    const pendingRun = new Promise<null>((resolve) => {
      resolveRun = resolve;
    });
    vi.mocked(startAssessmentRun).mockReturnValue(pendingRun);

    const { dialog } = await setupWizardTest();

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();
    properties.onCreateSuccess('new-def-key');

    // During loading: the wizard mock should be unmounted
    expect(screen.queryByTestId('wizard-mock')).toBeNull();

    // During loading: assignment Select NOT visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();

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

    const { dialog } = await setupWizardTest({ onClose });

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();
    properties.onCreateSuccess('test-key');

    // During auto-assessment loading, Cancel should be in the footer
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    // Click Cancel — the outer modal's Cancel during creating+loading calls onClose
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// No-match resolution — linking state and link flow
// ---------------------------------------------------------------------------

describe('No-match resolution — linking state and link flow', () => {
  it('choice prompt: Link to Existing Definition button is enabled when at least one linkable definition exists', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    const linkButton = await within(dialog).findByRole('button', { name: 'Link to Existing Definition' });
    expect(linkButton).toBeEnabled();
  });

  it('choice prompt: Link to Existing Definition button is disabled with Tooltip when the picker would be empty', async () => {
    const { dialog } = renderWithNoMatchCache({
      definitionPartials: [createDefinitionPartial({ yearGroupKey: 'year-11' })],
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

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
    clickStartAssessment(dialog);

    await clickLinkToExisting(dialog);

    // The LinkableDefinitionList radio group should appear
    const radio = await within(dialog).findByRole('radio');
    expect(radio).toBeInTheDocument();

    // Choice buttons should be gone
    expect(within(dialog).queryByRole('button', { name: 'Create New Definition' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Link to Existing Definition' })).toBeNull();
  });

  it('picker: clicking Cancel returns to the choice prompt', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    // Click Cancel in the picker footer
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // Choice buttons should reappear
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Link to Existing Definition' })).toBeInTheDocument();
    });

    // Picker should be gone (no radio buttons)
    expect(within(dialog).queryByRole('radio')).toBeNull();
  });

  it('picker: Link button is disabled when no row is selected', async () => {
    const { dialog } = renderWithNoMatchCache();

    await selectAssignment(dialog);
    clickStartAssessment(dialog);
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
    expect(alert).toHaveTextContent(/Upsert failed/);

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
    expect(alert).toHaveTextContent(/assessment run failed/i);

    // Modal does not close — Cancel button still present
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('DEFINITION_STALE recovery: startAssessmentRun fails with DEFINITION_STALE after a successful upsert', async () => {
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

    // Should transition to stale recovery — wizard should appear with stale definition data pre-populated
    const wizard = await screen.findByTestId('wizard-mock');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wizardProperties = (wizard as any).__wizardProps || {};
    expect(wizardProperties.open).toBe(true);
    // In stale recovery, the wizard pre-populates from the stale definition
    expect(wizardProperties.initialValues).toBeDefined();
    // The initialValues should contain data from the stale definition
    expect(wizardProperties.initialValues).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        yearGroup: expect.any(String),
      })
    );
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
    vi.mocked(upsertAssignmentDefinition).mockResolvedValue(DEFAULT_UPSERT_RESULT as any);

    const { queryClient } = renderWithNoMatchCache({ onClose });
    cleanup();

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AssessTaskModal {...defaultProperties({ onClose })} />
      </QueryClientProvider>
    );

    const dialog = screen.getByRole('dialog', { name: MODAL_TITLE });
    await selectAssignment(dialog);
    clickStartAssessment(dialog);

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
    clickStartAssessment(dialog);
    await clickLinkToExisting(dialog);

    // Click Cancel in the picker footer — should return to choice, not close modal
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // noMatchResolution returns to 'choice' — choice buttons reappear
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Create New Definition' })).toBeInTheDocument();
    });

    // The picker is no longer visible — no radio buttons
    expect(within(dialog).queryByRole('radio')).toBeNull();
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
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

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
});

// ---------------------------------------------------------------------------
// Regression: Issue #260 – dropdown should not appear after successful assessment
// ---------------------------------------------------------------------------

describe('Issue #260 regression — dropdown hidden on success', () => {
  it('wizard create success: assignment dropdown is not visible after successful trigger', async () => {
    const { dialog } = await setupWizardTest({
      startRunResult: null,
      startRunType: 'resolve',
    });

    await clickCreateNewDefinition(dialog);
    const properties = await getWizardProperties();
    properties.onCreateSuccess('new-def-key');

    // Wait for success state
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);

    // Dropdown should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    // "Select assignment" label should NOT be visible
    expect(within(dialog).queryByText('Select assignment')).toBeNull();
  });

  it('matched flow success: assignment dropdown is not visible after successful trigger', async () => {
    const matchedDefinition = createDefinitionPartial();
    const { dialog } = renderWithCache({
      classPartials: [
        createFixtureClassPartial({ classId: MOCK_CLASS_ID, yearGroupKey: 'year-10' }),
      ],
      definitionPartials: [matchedDefinition],
      findMatchResult: { kind: 'matched', definition: matchedDefinition },
      startRunResult: null,
      startRunType: 'resolve',
    });

    await selectAssignment(dialog);
    clickStartAssessment(dialog);

    // Wait for success state
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);

    // Dropdown should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    // "Select assignment" label should NOT be visible
    expect(within(dialog).queryByText('Select assignment')).toBeNull();
  });

  it('link flow success: assignment dropdown is not visible after successful trigger', async () => {
    const { dialog } = renderWithNoMatchCache({
      upsertResult: DEFAULT_UPSERT_RESULT,
      upsertType: 'resolve',
      startRunResult: null,
      startRunType: 'resolve',
    });

    await performLinkFlow(dialog);

    // Wait for success state
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent(/assessment started for/i);

    // Dropdown should NOT be visible
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    // "Select assignment" label should NOT be visible
    expect(within(dialog).queryByText('Select assignment')).toBeNull();
  });
});
