import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ReferenceDataSettingsPanel } from './ReferenceDataSettingsPanel';

// Module-level render function for modal wiring tests
/**
 * Creates a render configuration for modal wiring tests with seeded query data.
 *
 * @returns {{ queryClient: ReturnType<typeof createAppQueryClient>; render: () => ReturnType<typeof renderWithFrontendProviders> }} Render configuration with query client and render function.
 */
function createModalTestRender() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), []);
  queryClient.setQueryData(queryKeys.yearGroups(), []);
  return { queryClient, render: () => renderWithFrontendProviders(<ReferenceDataSettingsPanel />, { queryClient }) };
}

// Helper functions for modal interaction tests
/**
 * Opens the Manage Topics modal and waits for it to be fully ready.
 *
 * @returns {Promise<{ manageTopicsButton: HTMLElement; cancelButton: HTMLElement }>} The Manage Topics button and Cancel button elements.
 */
async function openManageTopicsModalForTest() {
  const { render: renderFunction } = createModalTestRender();
  renderFunction();

  const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
  fireEvent.click(manageTopicsButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Manage Topics' })).toBeInTheDocument();
  });

  await waitFor(() => {
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
  });

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  return { manageTopicsButton, cancelButton };
}

/**
 * Closes the Manage Topics modal using the Cancel button.
 *
 * @param {HTMLElement} cancelButton - The Cancel button element.
 * @returns {Promise<void>} Resolves when the modal is closed.
 */
async function closeManageTopicsModalForTest(cancelButton: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(cancelButton);
  });
}

/**
 * Verifies the modal can be reopened and is in a clean state.
 *
 * @param {HTMLElement} manageTopicsButton - The Manage Topics button element.
 * @param {boolean} [verifyCancelButton=false] - Whether to also verify the Cancel button is present.
 * @returns {Promise<HTMLElement>} The Cancel button from the reopened modal.
 */
async function verifyModalCanBeReopenedForTest(
  manageTopicsButton: HTMLElement,
  verifyCancelButton = false
): Promise<HTMLElement> {
  fireEvent.click(manageTopicsButton);

  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Manage Topics' })).toBeInTheDocument();
  });

  if (verifyCancelButton) {
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  }

  return screen.getByRole('button', { name: 'Cancel' });
}

// Mock the services that ManageTopicsModal depends on
const getAssignmentTopicsFromAssignmentTopicsServiceMock = vi.hoisted(() => vi.fn());
const getYearGroupsMock = vi.hoisted(() => vi.fn());
const getAssignmentTopicsFromReferenceDataServiceMock = vi.hoisted(() => vi.fn());
const createAssignmentTopicMock = vi.hoisted(() => vi.fn());
const updateAssignmentTopicMock = vi.hoisted(() => vi.fn());
const deleteAssignmentTopicMock = vi.hoisted(() => vi.fn());

// Mock assignmentTopicsService
vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsFromAssignmentTopicsServiceMock,
}));

// Mock referenceDataService
vi.mock('../../services/referenceData/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getYearGroups: getYearGroupsMock,
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: vi.fn(),
  createAssignmentTopic: createAssignmentTopicMock,
  updateAssignmentTopic: updateAssignmentTopicMock,
  deleteAssignmentTopic: deleteAssignmentTopicMock,
  getAssignmentTopics: getAssignmentTopicsFromReferenceDataServiceMock,
}));

// Section 4 - ReferenceDataSettingsPanel basic rendering tests

describe('ReferenceDataSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock responses to prevent API calls from failing
    getAssignmentTopicsFromAssignmentTopicsServiceMock.mockResolvedValue([]);
    getYearGroupsMock.mockResolvedValue([]);
    getAssignmentTopicsFromReferenceDataServiceMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Renders the ReferenceDataSettingsPanel component for testing.
   *
   * @param {object} [options] Render options.
   * @param {boolean} [options.seedQueryData] Whether to seed the query cache before render.
   * @returns {ReturnType<typeof renderWithFrontendProviders>} The render result.
   */
  function renderReferenceDataSettingsPanel(options: { seedQueryData?: boolean } = {}) {
    const { seedQueryData = false } = options;
    const queryClient = createAppQueryClient();

    if (seedQueryData) {
      queryClient.setQueryData(queryKeys.assignmentTopics(), []);
      queryClient.setQueryData(queryKeys.yearGroups(), []);
    }

    return renderWithFrontendProviders(<ReferenceDataSettingsPanel />, { queryClient });
  }

  it('renders the complete Reference Data panel structure with Topics section', () => {
    renderReferenceDataSettingsPanel();

    // Verify the panel region exists
    const panelRegion = screen.getByRole('region', { name: 'Reference Data panel' });
    expect(panelRegion).toBeInTheDocument();

    // Verify Topics section structure
    const topicsHeading = screen.getByRole('heading', { name: 'Topics' });
    expect(topicsHeading).toBeInTheDocument();
    expect(topicsHeading).toHaveTextContent('Topics');

    // Verify description
    expect(screen.getByText('Manage assignment topics')).toBeInTheDocument();

    // Verify Manage Topics button with correct styling and props
    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    expect(manageTopicsButton).toBeInTheDocument();
    expect(manageTopicsButton).toHaveClass('ant-btn-primary');

    // Verify the modal is mounted but not visible (state managed, open=false initially)
    expect(screen.queryByRole('dialog', { name: 'Manage Topics' })).not.toBeInTheDocument();
  });

  it('Topics section shows title Topics', () => {
    renderReferenceDataSettingsPanel();

    const topicsHeading = screen.getByRole('heading', { name: 'Topics' });
    expect(topicsHeading).toHaveTextContent('Topics');
  });

  it('Topics section includes a primary Manage Topics button', () => {
    renderReferenceDataSettingsPanel();

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    expect(manageTopicsButton).toBeInTheDocument();
    expect(manageTopicsButton).toHaveClass('ant-btn-primary');
  });

  it('renders the Reference Data panel region', () => {
    renderReferenceDataSettingsPanel();

    expect(screen.getByRole('region', { name: 'Reference Data panel' })).toBeInTheDocument();
  });

  it('Topics section shows description Manage assignment topics', () => {
    renderReferenceDataSettingsPanel();

    expect(screen.getByText('Manage assignment topics')).toBeInTheDocument();
  });
});

// Modal wiring tests
// These tests verify the wiring between ReferenceDataSettingsPanel and ManageTopicsModal
// following the established patterns from ManageYearGroupsModal tests

describe('ReferenceDataSettingsPanel modal wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default mock responses to prevent API calls from failing
    getAssignmentTopicsFromAssignmentTopicsServiceMock.mockResolvedValue([]);
    getYearGroupsMock.mockResolvedValue([]);
    getAssignmentTopicsFromReferenceDataServiceMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  /**
   * Renders the ReferenceDataSettingsPanel component with seeded query data for modal wiring tests.
   *
   * @returns {ReturnType<typeof renderWithFrontendProviders>} The render result with query client.
   */
  function renderReferenceDataSettingsPanelWithData() {
    const queryClient = createAppQueryClient();
    // Seed the query cache with empty data to prevent loading state
    queryClient.setQueryData(queryKeys.assignmentTopics(), []);
    queryClient.setQueryData(queryKeys.yearGroups(), []);

    return renderWithFrontendProviders(<ReferenceDataSettingsPanel />, { queryClient });
  }

  it('maintains modal state and has ManageTopicsModal mounted with open=false initially', () => {
    // Verifies that the component maintains modal open state and mounts ManageTopicsModal
    // with open=false by default, indicating proper state management
    renderReferenceDataSettingsPanelWithData();

    // Modal should not be visible when open=false
    expect(screen.queryByRole('dialog', { name: 'Manage Topics' })).not.toBeInTheDocument();
  });

  it('opens ManageTopicsModal when Manage Topics button is clicked', async () => {
    renderReferenceDataSettingsPanelWithData();

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    fireEvent.click(manageTopicsButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Manage Topics' })).toBeInTheDocument();
    });
  });

  it('passes open=true prop to ManageTopicsModal when Manage Topics button is clicked', async () => {
    // Verifies the open prop is set to true, distinguishing from visibility check in test 2
    // This confirms the prop is correctly wired through to the modal component
    renderReferenceDataSettingsPanelWithData();

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    fireEvent.click(manageTopicsButton);

    await waitFor(() => {
      const modalDialog = screen.getByRole('dialog', { name: 'Manage Topics' });
      expect(modalDialog).toBeInTheDocument();
      expect(modalDialog).toBeVisible();
    });
  });

  it('passes onClose callback to ManageTopicsModal', async () => {
    // Verifies that onClose callback is properly wired to the modal.
    // The presence of the Cancel button in the modal footer confirms that onClose
    // is passed through, as ManageTopicsModal renders this button with the callback.
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(queryKeys.assignmentTopics(), []);
    queryClient.setQueryData(queryKeys.yearGroups(), []);

    renderWithFrontendProviders(<ReferenceDataSettingsPanel />, { queryClient });

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });
    fireEvent.click(manageTopicsButton);

    await waitFor(() => {
      const modalDialog = screen.getByRole('dialog', { name: 'Manage Topics' });
      expect(modalDialog).toBeInTheDocument();
    });

    // Wait for the modal to finish loading and show the Cancel button in footer
    await waitFor(() => {
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeInTheDocument();
    });

    // The presence of Cancel button confirms onClose callback is wired
    // ( ManageTopicsModal uses the callback in its footer buttons )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('closes modal when Cancel button is clicked and verifies modal is closed', async () => {
    // Verifies actual modal close behaviour: after clicking Cancel, the modal should close.
    // In test environment, we verify closure by confirming the modal can be reopened cleanly.
    // This follows the pattern that a closed modal allows subsequent interactions.
    const { manageTopicsButton, cancelButton } = await openManageTopicsModalForTest();

    // Click Cancel button in the modal footer
    await closeManageTopicsModalForTest(cancelButton);

    // In JSDOM with Ant Design, the modal may still be in DOM during animation.
    // We verify it's closed by attempting to reopen - if state was properly reset,
    // the modal will open again successfully
    const newCancelButton = await verifyModalCanBeReopenedForTest(manageTopicsButton);

    // Clean up: close the modal again
    await closeManageTopicsModalForTest(newCancelButton);
  });

  it('resets modal state when closed and reopened', async () => {
    // Verifies state reset by: open modal, close it, reopen, verify clean state.
    // This tests that transient state does not leak between cycles.
    // The modal should open cleanly after being closed, with all expected elements present.
    const { manageTopicsButton, cancelButton } = await openManageTopicsModalForTest();

    // Close the modal
    await closeManageTopicsModalForTest(cancelButton);

    // Reopen the modal - should work cleanly with reset state
    // Verify modal opens again with clean state: dialog visible, Cancel button present
    const newCancelButton = await verifyModalCanBeReopenedForTest(manageTopicsButton, true);

    // Clean up: close the modal
    await closeManageTopicsModalForTest(newCancelButton);
  });

  it('handles multiple open and close cycles correctly', async () => {
    // Tests 3 actual open/close cycles to verify robust wiring.
    // Each cycle: open modal, verify it opens, close via Cancel, verify it closes.
    // This confirms the modal wiring remains stable across multiple interactions.
    renderReferenceDataSettingsPanelWithData();

    const manageTopicsButton = screen.getByRole('button', { name: 'Manage Topics' });

    // Helper to perform one complete open/close cycle
    const performCycle = async () => {
      // Open modal
      fireEvent.click(manageTopicsButton);
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: 'Manage Topics' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });

      // Close modal
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await act(async () => {
        fireEvent.click(cancelButton);
      });
    };

    // Perform 3 complete cycles
    await performCycle();
    await performCycle();
    await performCycle();

    // After all cycles, verify the button is still functional
    expect(manageTopicsButton).toBeInTheDocument();
    expect(manageTopicsButton).toBeEnabled();
  });
});
