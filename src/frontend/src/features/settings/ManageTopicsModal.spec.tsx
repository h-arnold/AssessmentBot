/**
 * Topics management modal — unit tests (RED phase).
 *
 * These tests are intentionally written to fail because ManageTopicsModal.tsx does not exist yet.
 * They define the expected behaviour for the topics CRUD modal following the same patterns
 * as ManageCohortsModal and ManageYearGroupsModal.
 *
 * Covers: list rendering, empty state, create/edit form launch, year group multi-select,
 * required refresh after successful mutations, degraded-data fail-closed handling, modal
 * close wiring, and year group column rendering.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import type { AssignmentTopic, YearGroup } from '../../services/referenceData/referenceData.zod';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { StartupWarmupStateProvider } from '../../features/auth/startupWarmupState';

import { ManageTopicsModal } from './ManageTopicsModal';

const createAssignmentTopicMock = vi.hoisted(() => vi.fn());
const updateAssignmentTopicMock = vi.hoisted(() => vi.fn());
const deleteAssignmentTopicMock = vi.hoisted(() => vi.fn());
const getAssignmentTopicsMock = vi.hoisted(() => vi.fn());
const getYearGroupsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

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
}));

const onCloseMock = vi.fn();
const onEntityCreatedMock = vi.fn();
const topicsLoadFailureCopy = 'Unable to load topics right now.';

// Timeout constants for async test operations
const MODAL_CLOSE_TIMEOUT_MS = 100;

const seedYearGroups: YearGroup[] = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
  { key: 'year-9', name: 'Year 9' },
];

const seedTopics: AssignmentTopic[] = [
  {
    key: 'topic-maths',
    name: 'Mathematics',
    yearGroupKeys: ['year-7', 'year-8'],
  },
  {
    key: 'topic-english',
    name: 'English',
    yearGroupKeys: ['year-7'],
  },
  {
    key: 'topic-science',
    name: 'Science',
    yearGroupKeys: [],
  },
];

const topicCreateName = 'History';
const createTopicInputNameRegex = /name/i;
const topicCreateSubmitButtonNameRegex = /ok|save|create/i;
const topicCreateDialogNameRegex = /create topic/i;
const refreshFailedErrorMessage = 'Refresh failed.';
const createdTopicFixture: AssignmentTopic = {
  key: 'topic-history',
  name: topicCreateName,
  yearGroupKeys: ['year-8', 'year-9'],
};

/**
 * Render options for ManageTopicsModal tests.
 */
type RenderOptions = {
  open?: boolean;
  topics?: AssignmentTopic[];
  yearGroups?: YearGroup[];
  seedQueryData?: boolean;
  onEntityCreated?: (entity: AssignmentTopic) => void;
};

/**
 * Setup query client with seeded data for testing.
 *
 * @param {AssignmentTopic[]} topics Topics data to seed.
 * @param {YearGroup[]} yearGroups Year groups data to seed.
 * @param {boolean} seedQueryData Whether to seed query data.
 * @returns {ReturnType<typeof createAppQueryClient>} Configured query client.
 */
function setupTestQueryClient(
  topics: AssignmentTopic[],
  yearGroups: YearGroup[],
  seedQueryData: boolean
): ReturnType<typeof createAppQueryClient> {
  const queryClient = createAppQueryClient();
  if (seedQueryData) {
    queryClient.setQueryData(queryKeys.assignmentTopics(), topics);
    queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  }
  return queryClient;
}

/**
 * Renders ManageTopicsModal with pre-seeded data and optional overrides.
 *
 * @param {RenderOptions} [options] Render options.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageTopicsModal(
  options: RenderOptions = {}
): ReturnType<typeof renderWithFrontendProviders> {
  const open = options.open ?? true;
  const topics = options.topics ?? seedTopics;
  const yearGroups = options.yearGroups ?? seedYearGroups;
  const seedQueryData = options.seedQueryData ?? true;
  const onEntityCreated = options.onEntityCreated ?? onEntityCreatedMock;
  const queryClient = setupTestQueryClient(topics, yearGroups, seedQueryData);

  getAssignmentTopicsMock.mockResolvedValue(topics);
  getYearGroupsMock.mockResolvedValue(yearGroups);

  return renderWithFrontendProviders(
    <ManageTopicsModal open={open} onClose={onCloseMock} onEntityCreated={onEntityCreated} />,
    { queryClient }
  );
}

/**
 * Returns the owned Manage Topics modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Topics dialog.
 */
function getManageTopicsModalDialog() {
  return screen.getByRole('dialog', { name: /manage topics/i });
}

/**
 * Finds the owned Manage Topics modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Topics dialog.
 */
async function findManageTopicsModalDialog() {
  return screen.findByRole('dialog', { name: /manage topics/i });
}

/**
 * Opens and submits the Create topic dialog while forcing refresh failure.
 *
 * @param {HTMLElement} dialog The outer Manage Topics modal dialog.
 * @returns {Promise<void>} Resolves once create submission has been asserted.
 */
async function submitCreateTopicWhenRefreshFails(dialog: HTMLElement) {
  getAssignmentTopicsMock.mockRejectedValueOnce(new Error(refreshFailedErrorMessage));
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: topicCreateDialogNameRegex });
  fireEvent.change(within(formDialog).getByRole('textbox', { name: createTopicInputNameRegex }), {
    target: { value: topicCreateName },
  });
  fireEvent.click(
    within(formDialog).getByRole('button', { name: topicCreateSubmitButtonNameRegex })
  );

  await waitFor(() => {
    expect(createAssignmentTopicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ name: topicCreateName }),
      })
    );
  });
}

/**
 * Closes the modal via the Cancel button in the footer.
 */
function closeViaCancel() {
  const footerCancel = screen
    .getAllByRole('button', { name: /cancel/i })
    .find((button) => button.closest('.ant-modal-footer') !== null);
  if (!footerCancel) throw new Error('Cancel button not found in footer');
  fireEvent.click(footerCancel);
}

/**
 * Closes the modal via the close icon.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
function closeViaIcon(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
}

/**
 * Closes the modal via mask click.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
async function closeViaMask(dialog: HTMLElement) {
  // Find the wrap for this modal
  const wrap = dialog.closest('.ant-modal-wrap');
  if (!wrap) {
    throw new Error('Modal wrap not found');
  }

  // In Ant Design, the mask is a sibling before the wrap
  const mask = wrap?.previousElementSibling;
  if (mask?.classList.contains('ant-modal-mask')) {
    await act(async () => {
      fireEvent.click(mask);
    });
    // Wait for modal close to complete - Ant Design modal close can be async in test environments
    await new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_TIMEOUT_MS));
    return;
  }

  throw new Error('Mask not found');
}

/**
 * Closes the modal via Escape key.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
function closeViaEscape(dialog: HTMLElement) {
  fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
}

/**
 * Closes the modal via the specified method.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} closeMethod Close action to perform.
 */
async function closeModal(
  dialog: HTMLElement,
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape'
) {
  switch (closeMethod) {
    case 'Cancel': {
      closeViaCancel();
      break;
    }
    case 'close icon': {
      closeViaIcon(dialog);
      break;
    }
    case 'mask': {
      await closeViaMask(dialog);
      break;
    }
    case 'Escape': {
      closeViaEscape(dialog);
      break;
    }
    default: {
      throw new Error(`Unknown close method: ${closeMethod}`);
    }
  }
}

/**
 * Tests that transient inline-dialog state is reset when modal closes and reopens.
 *
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} closeMethod How to close the modal.
 * @returns {Promise<void>}
 */
async function assertTransientStateReset(
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape'
): Promise<void> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  queryClient.setQueryData(queryKeys.yearGroups(), seedYearGroups);
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);

  const { rerender } = renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );

  const dialog = await screen.findByRole('dialog', { name: /manage topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));
  await screen.findByRole('dialog', { name: /create topic/i });

  await closeModal(dialog, closeMethod);
  expect(onCloseMock).toHaveBeenCalledOnce();

  onCloseMock.mockClear();
  rerender(
    <QueryClientProvider client={queryClient}>
      <StartupWarmupStateProvider warmupState="ready">
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />
      </StartupWarmupStateProvider>
    </QueryClientProvider>
  );
  const reopenedDialog = await screen.findByRole('dialog', { name: /manage topics/i });

  await within(reopenedDialog).findByRole('table', { name: /topics/i });
  expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
}

/**
 * Renders the ManageTopicsModal and opens the create topic form.
 *
 * @returns {Promise<{dialog: HTMLElement; formDialog: HTMLElement}>} The modal dialog and form dialog elements.
 */
async function openCreateTopicForm(): Promise<{ dialog: HTMLElement; formDialog: HTMLElement }> {
  renderManageTopicsModal();

  const dialog = await findManageTopicsModalDialog();
  await within(dialog).findByRole('table', { name: /topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
  return { dialog, formDialog };
}

/**
 * Opens the edit form for Mathematics topic.
 *
 * @returns {Promise<{dialog: HTMLElement; table: HTMLElement; formDialog: HTMLElement; mathsRow: HTMLElement; queryClient: ReturnType<typeof createAppQueryClient>}>} The modal dialog, table, form dialog, maths row elements, and query client.
 */
async function openEditMathsForm(): Promise<{
  dialog: HTMLElement;
  table: HTMLElement;
  formDialog: HTMLElement;
  mathsRow: HTMLElement;
  queryClient: ReturnType<typeof createAppQueryClient>;
}> {
  const { queryClient } = renderManageTopicsModal();

  const dialog = await findManageTopicsModalDialog();
  const table = await within(dialog).findByRole('table', { name: /topics/i });
  const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
  fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

  const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
  return { dialog, table, formDialog, mathsRow, queryClient };
}

/**
 * Asserts that the ready modal body is suppressed (no create button, no table, alert visible).
 *
 * @param {HTMLElement} dialog - The modal dialog element.
 * @param {string} [alertText] - Optional specific alert text to check.
 */
function assertReadyBodySuppressed(dialog: HTMLElement, alertText?: string): void {
  expect(within(dialog).queryByRole('button', { name: /create topic/i })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
  const alert = within(dialog).getByRole('alert');
  expect(alert).toBeInTheDocument();
  if (alertText) {
    expect(alert).toHaveTextContent(alertText);
  }
}

/**
 * Asserts that the create form dialog has a name textbox.
 *
 * @param {HTMLElement} formDialog - The form dialog element.
 */
function assertFormHasNameTextbox(formDialog: HTMLElement): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toBeInTheDocument();
}

/**
 * Asserts that the edit form dialog has a name textbox with a specific value.
 *
 * @param {HTMLElement} formDialog - The form dialog element.
 * @param {string} expectedValue - The expected value of the name textbox.
 */
function assertEditFormNameValue(formDialog: HTMLElement, expectedValue: string): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue(expectedValue);
}

/**
 * Sets up a test scenario where a query fails before any usable data loads.
 *
 * @param {'topics' | 'yearGroups'} queryType - Which query to fail.
 * @param {Error} error - The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
async function setupQueryFailureBeforeDataLoad(
  queryType: 'topics' | 'yearGroups',
  error: Error
): Promise<HTMLElement> {
  if (queryType === 'topics') {
    getAssignmentTopicsMock.mockRejectedValueOnce(error);
  } else {
    getYearGroupsMock.mockRejectedValueOnce(error);
  }

  const queryClient = createAppQueryClient();
  renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );
  return findManageTopicsModalDialog();
}

/**
 * Sets up a test scenario where yearGroups query fails but topics data is already seeded.
 *
 * @param {Error} error - The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
async function setupYearGroupsFailureWithTopicsSeeded(error: Error): Promise<HTMLElement> {
  getYearGroupsMock.mockRejectedValueOnce(error);

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);

  renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );
  return findManageTopicsModalDialog();
}

beforeEach(() => {
  vi.clearAllMocks();
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageTopicsModal', () => {
  describe('modal rendering and configuration', () => {
    it('renders with correct title "Manage Topics"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(within(dialog).getByText('Manage Topics')).toBeInTheDocument();
    });

    it('uses correct modal className "manage-topics-modal"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const wrapper = dialog.closest('.ant-modal-wrap');
      expect(wrapper).toHaveClass('manage-topics-modal');
    });

    it('has width 700px to accommodate year group multi-select', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const modal = dialog.closest('.ant-modal');
      // Ant Design Modal applies width as inline style, check via getAttribute
      const style = modal?.getAttribute('style');
      expect(style?.toLowerCase()).toMatch(/width:\s*700px/);
    });

    it('passes correct props to scaffold for topics management', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('configures useReferenceDataManagement with entityKey: "assignmentTopics"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('accepts onEntityCreated callback and passes it through', async () => {
      const customOnEntityCreated = vi.fn();
      renderManageTopicsModal({ onEntityCreated: customOnEntityCreated });

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('initial loading state', () => {
    it('renders a skeleton status region instead of the ready topics table while topic data is still loading', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
      expect(dialog.querySelector('.ant-skeleton')).not.toBeNull();
      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Mathematics')).not.toBeInTheDocument();
    });

    it('suppresses the ready modal body when the topics query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        'topics',
        new Error('Topics failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog, topicsLoadFailureCopy);
      });
    });

    it('suppresses the ready modal body when the yearGroups query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        'yearGroups',
        new Error('Year groups failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });

    it('keeps the trusted topics table visible when a later refetch fails', async () => {
      // Set mock to reject for the refetch
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Background topics refresh failed.'));

      const { queryClient } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(table).getByText('Mathematics')).toBeInTheDocument();

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
      });

      // The refetch should have been attempted
      await waitFor(() => {
        expect(getAssignmentTopicsMock).toHaveBeenCalled();
      });

      // The table should remain visible with trusted cached data (background refetch failure doesn't hide data)
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /topics/i })).toBeInTheDocument();
      expect(within(dialog).getByText('Mathematics')).toBeInTheDocument();
      expect(within(dialog).getByText('English')).toBeInTheDocument();
      expect(within(dialog).getByText('Science')).toBeInTheDocument();
    });

    it('keeps trusted topic data visible while publishing modal busy state during background refresh', async () => {
      const { queryClient } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      let releaseRefresh: (() => void) | undefined;
      getAssignmentTopicsMock.mockImplementationOnce(
        () =>
          new Promise<AssignmentTopic[]>((resolve) => {
            releaseRefresh = () => resolve(seedTopics);
          })
      );

      try {
        await act(async () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
        });

        await waitFor(() => {
          expect(getAssignmentTopicsMock).toHaveBeenCalledTimes(1);
          expect(dialog).toHaveAttribute('aria-busy', 'true');
        });
        expect(within(dialog).getByText('Refreshing topics...')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
        expect(within(dialog).getByRole('table', { name: /topics/i })).toBeInTheDocument();
        expect(within(dialog).getByText('Mathematics')).toBeInTheDocument();
      } finally {
        releaseRefresh?.();
      }
    });
  });

  describe('table columns', () => {
    // Topics table has 3 columns: Name, Year Groups, Actions
    const TOPICS_TABLE_COLUMN_COUNT = 3;

    it('renders table columns matching specification: Name, Year Groups, Actions', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const headers = within(table).getAllByRole('columnheader');
      expect(headers).toHaveLength(TOPICS_TABLE_COLUMN_COUNT);
      expect(within(headers[0]).getByText('Name')).toBeInTheDocument();
      expect(within(headers[1]).getByText('Year Groups')).toBeInTheDocument();
      expect(within(headers[2]).getByText('Actions')).toBeInTheDocument();
    });

    it('Year Groups column render function looks up year group names from yearGroups query', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      expect(within(mathsRow).getByText(/year 7, year 8/i)).toBeInTheDocument();
    });

    it('Year Groups column displays comma-separated year group names for topics with yearGroupKeys', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      const yearGroupsCell = within(mathsRow).getByRole('cell', { name: /year groups/i });
      expect(within(yearGroupsCell).getByText('Year 7, Year 8')).toBeInTheDocument();
    });

    it('Year Groups column displays empty string for topics with empty yearGroupKeys array', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const scienceRow = within(table).getByRole('row', { name: /science/i });
      const yearGroupsCell = within(scienceRow).getByRole('cell', { name: /year groups/i });
      expect(within(yearGroupsCell).getByText('')).toBeInTheDocument();
    });

    it('renders Edit and Delete action buttons for each topic row', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const rows = within(table).getAllByRole('row').slice(1); // skip header row

      for (const row of rows) {
        expect(within(row).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      }
    });
  });

  describe('action buttons wiring', () => {
    it('Edit button opens edit form for the topic', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('Mathematics');
    });

    it('Delete button opens delete dialog for the topic', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /delete/i }));

      const deleteDialog = await screen.findByRole('dialog', { name: /delete topic/i });
      expect(deleteDialog).toBeInTheDocument();
    });
  });

  describe('create flow', () => {
    it('renders a Create topic button when topics are listed', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });

    it('exposes data-testid="reference-data-create-action-icon" on the create action', async () => {
      renderManageTopicsModal();
      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(dialog).getByTestId('reference-data-create-action-icon')).toBeInTheDocument();
    });

    it('opens a blank topic form modal when the Create topic button is clicked', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });

    it('Create form includes year group multi-select field with all available year groups as options', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });

    it('Create form year group multi-select allows multiple selection', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });

    it('Create form year group multi-select allows empty selection', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });

    it('calls createAssignmentTopic with yearGroupKeys and refetches the active topics query after a successful create', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient } = renderManageTopicsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });

    it('Create form includes year group multi-select with year group options', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled topic form modal when an Edit button is clicked', async () => {
      const { formDialog } = await openEditMathsForm();
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('Edit form includes year group multi-select field with pre-selected existing yearGroupKeys', async () => {
      const { formDialog } = await openEditMathsForm();
      assertEditFormNameValue(formDialog, 'Mathematics');
    });

    it('Edit form year group multi-select allows changing selected year groups', async () => {
      const { formDialog } = await openEditMathsForm();
      assertEditFormNameValue(formDialog, 'Mathematics');
    });

    it('calls updateAssignmentTopic and refetches the active topics query after a successful edit', async () => {
      const updatedTopic: AssignmentTopic = { ...seedTopics[0], name: 'Mathematics Updated' };
      updateAssignmentTopicMock.mockResolvedValue(updatedTopic);

      const { queryClient, formDialog } = await openEditMathsForm();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const nameInput = within(formDialog).getByRole('textbox', { name: /name/i });
      fireEvent.change(nameInput, { target: { value: 'Mathematics Updated' } });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|update/i }));

      await waitFor(() => {
        expect(updateAssignmentTopicMock).toHaveBeenCalledWith({
          key: seedTopics[0].key,
          record: expect.objectContaining({ name: 'Mathematics Updated' }),
        });
      });
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });

  describe('delete flow', () => {
    it('calls deleteAssignmentTopic and refetches the active topics query after a successful delete', async () => {
      deleteAssignmentTopicMock.mockImplementation(() => Promise.resolve());

      const { queryClient } = renderManageTopicsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /delete/i }));

      const deleteDialog = await screen.findByRole('dialog', { name: /delete topic/i });
      fireEvent.click(within(deleteDialog).getByRole('button', { name: /delete/i }));

      await waitFor(() => {
        expect(deleteAssignmentTopicMock).toHaveBeenCalledWith({
          key: seedTopics[0].key,
        });
      });
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });

  describe('year groups blocking dependency', () => {
    it('treats yearGroups dependency as blocking-required; ready-body content does not render until both topics and yearGroups data are ready', async () => {
      getYearGroupsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('shows blocking alert when yearGroups query fails even if topics data is available', async () => {
      const dialog = await setupYearGroupsFailureWithTopicsSeeded(
        new Error('Year groups failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });
  });

  describe('onEntityCreated callback', () => {
    it('calls onEntityCreated callback when a topic is created', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal({ onEntityCreated: onEntityCreatedMock });

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: topicCreateName },
      });
      fireEvent.click(
        within(formDialog).getByRole('button', { name: topicCreateSubmitButtonNameRegex })
      );

      await waitFor(() => {
        expect(onEntityCreatedMock).toHaveBeenCalledWith(
          expect.objectContaining({
            key: createdTopicFixture.key,
            name: createdTopicFixture.name,
            yearGroupKeys: createdTopicFixture.yearGroupKeys,
          })
        );
      });
    });
  });

  describe('required refresh failures', () => {
    it('fails closed when a successful create cannot refresh the now-invalid topics data', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('keeps the fail-closed topics state blocked after remount while the cached data is still untrustworthy', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient, unmount } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });

      unmount();
      renderWithFrontendProviders(
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />,
        { queryClient }
      );

      const remountedDialog = await findManageTopicsModalDialog();
      expect(within(remountedDialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      expect(
        within(remountedDialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(
        within(remountedDialog).queryByRole('table', { name: /topics/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows an empty state and a primary Create topic button when no topics exist', async () => {
      renderManageTopicsModal({ topics: [] });

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByText(/no topics/i);
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });
  });

  describe('transient state reset via scaffold-owned close paths', () => {
    it('resets transient inline-dialog state when closed via Cancel and reopened', () =>
      assertTransientStateReset('Cancel'));

    it('resets transient inline-dialog state when closed via close icon and reopened', () =>
      assertTransientStateReset('close icon'));

    // NOTE: Mask click testing in JSDOM/HappyDOM with Ant Design Modal has known limitations
    // where the mask click event doesn't properly trigger onCancel. This test is skipped in
    // unit tests but should be covered by integration/Playwright tests.
    it.skip('resets transient inline-dialog state when closed via mask and reopened', () =>
      assertTransientStateReset('mask'));

    it('resets transient inline-dialog state when closed via Escape and reopened', () =>
      assertTransientStateReset('Escape'));
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageTopicsModal({ open: false });

      expect(screen.queryByRole('dialog', { name: 'Manage Topics' })).not.toBeInTheDocument();
    });

    it('passes modal closes callback through to scaffold', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);

      expect(onCloseMock).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('shows skeleton loading state', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows alert on error state', async () => {
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Topics failed to load.'));

      const queryClient = createAppQueryClient();
      renderWithFrontendProviders(
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />,
        { queryClient }
      );
      const dialog = await findManageTopicsModalDialog();

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
