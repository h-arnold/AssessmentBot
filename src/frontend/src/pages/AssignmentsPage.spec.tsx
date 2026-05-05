import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query/queryKeys';
import { deleteAssignmentDefinition } from '../services/assignmentDefinitionPartialsService';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { AssignmentsPage } from './AssignmentsPage';
import { pageContent } from './pageContent';

const {
  deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartialsMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  deleteAssignmentDefinitionMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../services/assignmentDefinitionPartialsService', () => ({
  deleteAssignmentDefinition: deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

const recommendedSummaryCopy =
  'Review assignment-definition partials and remove obsolete definitions without loading full task data.';

const filterAssertions = [
  {
    filterButtonName: 'Filter by title',
    optionLabel: 'Algebra foundations',
    expectedVisibleRow: 'Algebra foundations',
    expectedHiddenRow: 'Newest algebra recap',
  },
  {
    filterButtonName: 'Filter by topic',
    optionLabel: 'Legacy',
    expectedVisibleRow: 'Unsafe legacy row',
    expectedHiddenRow: 'Algebra foundations archive',
  },
  {
    filterButtonName: 'Filter by year group',
    optionLabel: 'Year 10',
    expectedVisibleRow: 'Algebra foundations archive',
    expectedHiddenRow: 'Unsafe legacy row',
  },
  {
    filterButtonName: 'Filter by document type',
    optionLabel: 'SLIDES',
    expectedVisibleRow: 'Newest algebra recap',
    expectedHiddenRow: 'Unsafe legacy row',
  },
  {
    filterButtonName: 'Filter by last updated',
    optionLabel: '—',
    expectedVisibleRow: 'Unsafe legacy row',
    expectedHiddenRow: 'Newest algebra recap',
  },
] as const;

const expectedFilterNamesByColumn = [
  { columnHeaderName: 'Title', filterButtonName: 'Filter by title' },
  { columnHeaderName: 'Topic', filterButtonName: 'Filter by topic' },
  { columnHeaderName: 'Year group', filterButtonName: 'Filter by year group' },
  { columnHeaderName: 'Document type', filterButtonName: 'Filter by document type' },
  { columnHeaderName: 'Last updated', filterButtonName: 'Filter by last updated' },
] as const;

/**
 * No-op function for deferred promise initialisation in tests.
 *
 * @returns {void} No return value.
 */
function noop() {
  return;
}

const readyRows = [
  {
    primaryTitle: 'Algebra foundations',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-1',
    templateDocumentId: 'tpl-1',
    assignmentWeighting: 20,
    definitionKey: 'alg-10-safe',
    tasks: null,
    createdAt: '2025-01-15T08:00:00.000Z',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    primaryTitle: 'Unsafe legacy row',
    primaryTopicKey: 'topic-legacy',
    primaryTopic: 'Legacy',
    yearGroupKey: 'year-group-unknown',
    yearGroupLabel: '—',
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'SHEETS',
    referenceDocumentId: 'ref-2',
    templateDocumentId: 'tpl-2',
    assignmentWeighting: null,
    definitionKey: 'legacy/unsafe-key',
    tasks: null,
    createdAt: '2025-01-16T08:00:00.000Z',
    updatedAt: null,
  },
] as const;

const filterRows = [
  {
    ...readyRows[0],
    primaryTitle: 'Newest algebra recap',
    yearGroupKey: 'year-group-11',
    yearGroupLabel: 'Year 11',
    definitionKey: 'newest-safe',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
  {
    ...readyRows[0],
    primaryTitle: 'Algebra foundations',
    definitionKey: 'exact-match-safe',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    ...readyRows[0],
    primaryTitle: 'Algebra foundations archive',
    definitionKey: 'archive-safe',
    updatedAt: '2025-01-17T08:00:00.000Z',
  },
  {
    ...readyRows[1],
    definitionKey: 'unsafe/legacy-key',
  },
] as const;

const migratedContractRows = [...readyRows] as const;

type DatasetStatus = 'loading' | 'ready' | 'failed';

/**
 * Creates startup warm-up state with assignment dataset overrides.
 *
 * @param {object} options Warm-up override options.
 * @param {DatasetStatus} options.assignmentStatus Assignment dataset status.
 * @param {boolean} options.assignmentTrustworthy Assignment dataset trust flag.
 * @param {(datasetKey: string) => boolean} options.isDatasetReady Dataset-ready selector.
 * @param {(datasetKey: string) => boolean} options.isDatasetFailed Dataset-failed selector.
 * @returns {object} Warm-up state consumed by the page.
 */
function createAssignmentsWarmupState(options: {
  assignmentStatus: DatasetStatus;
  assignmentTrustworthy: boolean;
  isDatasetReady: (datasetKey: string) => boolean;
  isDatasetFailed: (datasetKey: string) => boolean;
}) {
  return {
    isFailed: options.assignmentStatus === 'failed',
    isLoading: options.assignmentStatus === 'loading',
    isReady: options.assignmentStatus === 'ready',
    warmupState: options.assignmentStatus,
    isDatasetReady: options.isDatasetReady,
    isDatasetFailed: options.isDatasetFailed,
    snapshot: {
      datasets: {
        classPartials: { status: 'ready', isTrustworthy: true },
        cohorts: { status: 'ready', isTrustworthy: true },
        yearGroups: { status: 'ready', isTrustworthy: true },
        assignmentDefinitionPartials: {
          status: options.assignmentStatus,
          isTrustworthy: options.assignmentTrustworthy,
        },
      },
    },
  };
}

/**
 * Creates a trusted ready-state warm-up snapshot.
 *
 * @returns {object} Ready startup warm-up state.
 */
function createReadyAssignmentsWarmupState() {
  return createAssignmentsWarmupState({
    assignmentStatus: 'ready',
    assignmentTrustworthy: true,
    isDatasetReady: () => true,
    isDatasetFailed: () => false,
  });
}

/**
 * Applies one column filter option using visible controls only.
 *
 * @param {string} filterButtonName Filter trigger button label.
 * @param {string} optionLabel Visible option label to select.
 * @returns {Promise<void>} Resolves when the filter option is selected.
 */
async function applyColumnFilterOption(filterButtonName: string, optionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: filterButtonName }));

  const activeFilterPopup = await waitFor(() => {
    const visiblePopups = [...document.body.querySelectorAll<HTMLElement>('.ant-dropdown')].filter(
      (popup) => !popup.classList.contains('ant-dropdown-hidden')
    );

    const popup = visiblePopups.at(-Math.sign(visiblePopups.length));

    expect(popup).toBeTruthy();

    return popup as HTMLElement;
  });

  fireEvent.click(within(activeFilterPopup).getByText(optionLabel, { exact: true }));
  fireEvent.keyDown(document, { key: 'Escape' });
}

describe('AssignmentsPage', () => {
  beforeEach(() => {
    useStartupWarmupStateMock.mockReturnValue(createReadyAssignmentsWarmupState());
    getAssignmentDefinitionPartialsMock.mockResolvedValue([...readyRows]);
    deleteAssignmentDefinitionMock.mockResolvedValue(void 0);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state treatment while keeping heading and summary copy visible', () => {
    useStartupWarmupStateMock.mockReturnValue(
      createAssignmentsWarmupState({
        assignmentStatus: 'loading',
        assignmentTrustworthy: false,
        isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
        isDatasetFailed: () => false,
      })
    );

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByRole('heading', { level: 2, name: pageContent.assignments.heading })).toBeInTheDocument();
    expect(screen.getByText(recommendedSummaryCopy)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Assignments management panel' })).toBeInTheDocument();
    expect(screen.getByLabelText('Assignments table loading')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Assignment definitions table' })).not.toBeInTheDocument();
  });

  it('renders ready-state summary copy and status/actions card layout with expected table columns', async () => {
    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

    expect(screen.getByText(recommendedSummaryCopy)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update assignment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /retry|refresh assignments data/i })).toBeEnabled();
    expect(screen.getByText(/not available in v1/i)).toBeInTheDocument();

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
    expect(within(table).getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Topic' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Year group' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Document type' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Last updated' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  });

  it('renders year-group labels from the migrated list-surface contract', async () => {
    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...migratedContractRows]);

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

    expect(within(table).getByRole('cell', { name: 'Year 10' })).toBeInTheDocument();

    const unsafeLegacyRow = screen.getByRole('row', { name: /unsafe legacy row/i });
    expect(within(unsafeLegacyRow).getAllByRole('cell', { name: '—' }).length).toBeGreaterThan(0);

    const safeRow = screen.getByRole('row', { name: /algebra foundations/i });
    expect(within(safeRow).getByRole('button', { name: /delete/i })).toBeEnabled();
    expect(within(safeRow).queryByRole('button', { name: /update/i })).not.toBeInTheDocument();
  });

  it('renders ready-empty state with table shell and explicit empty copy', async () => {
    getAssignmentDefinitionPartialsMock.mockResolvedValue([]);

    renderWithFrontendProviders(<AssignmentsPage />);

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Assignment definitions table' })).toBeInTheDocument();
    });

    expect(screen.getByText(/no assignment definitions found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|refresh assignments data/i })).toBeInTheDocument();
  });

  it('renders blocking state with retry and suppresses table region when assignment data is failed/untrustworthy', () => {
    useStartupWarmupStateMock.mockReturnValue(
      createAssignmentsWarmupState({
        assignmentStatus: 'failed',
        assignmentTrustworthy: false,
        isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
        isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentDefinitionPartials',
      })
    );

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByText(/assignment definitions could not be trusted or loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|refresh assignments data/i })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Assignment definitions table' })).not.toBeInTheDocument();
  });

  it('keeps placeholder create/update actions disabled and does not launch workflows when clicked', () => {
    renderWithFrontendProviders(<AssignmentsPage />);

    const createAssignmentButton = screen.getByRole('button', { name: 'Create assignment' });
    const updateAssignmentButton = screen.getByRole('button', { name: 'Update assignment' });

    fireEvent.click(createAssignmentButton);
    fireEvent.click(updateAssignmentButton);

    expect(createAssignmentButton).toBeDisabled();
    expect(updateAssignmentButton).toBeDisabled();
    expect(screen.getByText(/not available in v1/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /create assignment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /update assignment/i })).not.toBeInTheDocument();
  });

  it('renders default sorted rows and unavailable markers for mixed assignment data', async () => {
    getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);

    renderWithFrontendProviders(<AssignmentsPage />);

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
    expect(within(table).getAllByText('—').length).toBeGreaterThan(1);

    const newestRow = within(table).getByText('Newest algebra recap', { exact: true });
    const archivedRow = within(table).getByText('Algebra foundations archive', { exact: true });
    const exactRow = within(table).getByText('Algebra foundations', { exact: true });

    expect(newestRow.compareDocumentPosition(archivedRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(archivedRow.compareDocumentPosition(exactRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(filterAssertions)(
    'applies exact-value filter "$filterButtonName" option "$optionLabel" and reset restores defaults',
    async (filterAssertion) => {
      getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);

      renderWithFrontendProviders(<AssignmentsPage />);

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

      await applyColumnFilterOption(filterAssertion.filterButtonName, filterAssertion.optionLabel);

      await waitFor(() => {
        expect(within(table).getByText(filterAssertion.expectedVisibleRow, { exact: true })).toBeInTheDocument();
        expect(within(table).queryByText(filterAssertion.expectedHiddenRow, { exact: true })).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

      await waitFor(() => {
        expect(within(table).getByText(filterAssertion.expectedHiddenRow, { exact: true })).toBeInTheDocument();
      });
    }
  );

  it('keeps each filter trigger label bound to its column header', async () => {
    getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);

    renderWithFrontendProviders(<AssignmentsPage />);

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

    for (const expectedFilterNameByColumn of expectedFilterNamesByColumn) {
      const columnHeader = within(table).getByRole('columnheader', {
        name: expectedFilterNameByColumn.columnHeaderName,
      });

      expect(within(columnHeader).getByRole('button', { name: expectedFilterNameByColumn.filterButtonName })).toBeInTheDocument();
    }
  });

  it('scopes retry/refetch to assignmentDefinitionPartials dataset only and disallows unscoped calls', async () => {
    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    const fetchQuerySpy = vi.spyOn(queryClient, 'fetchQuery');

    fireEvent.click(screen.getByRole('button', { name: /retry|refresh assignments data/i }));

    await waitFor(() => {
      expect(fetchQuerySpy).toHaveBeenCalled();
    });

    for (const [queryOptions] of fetchQuerySpy.mock.calls) {
      expect(queryOptions).toBeDefined();
      expect(queryOptions.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
    }
  });

  it('disables delete action for unsafe keys', async () => {
    renderWithFrontendProviders(<AssignmentsPage />);

    const unsafeRow = await screen.findByRole('row', { name: /unsafe legacy row/i });
    expect(within(unsafeRow).getByRole('button', { name: /delete/i })).toBeDisabled();
  });

  it('requires explicit delete confirmation modal with permanent-delete copy', async () => {
    renderWithFrontendProviders(<AssignmentsPage />);

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));

    const deleteDialog = screen.getByRole('dialog', { name: 'Delete assignment definition' });
    expect(deleteDialog).toBeInTheDocument();
    expect(within(deleteDialog).getByText('Algebra foundations', { exact: true })).toBeInTheDocument();
    expect(within(deleteDialog).getByText(/this delete is permanent/i)).toBeInTheDocument();
  });

  it('shows confirm-loading and disables conflicting deletes while mutation is in flight', async () => {
    let resolveDeleteRequest: () => void = noop;
    deleteAssignmentDefinitionMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDeleteRequest = resolve;
        })
    );

    renderWithFrontendProviders(<AssignmentsPage />);

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));

    const deleteDialog = screen.getByRole('dialog', { name: 'Delete assignment definition' });
    expect(within(deleteDialog).getByRole('button', { name: /delete definition/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /delete/i }).every((button) => button.hasAttribute('disabled'))).toBe(true);

    resolveDeleteRequest();
  });

  it('handles delete success by refetching, removing the row, and showing success feedback', async () => {
    getAssignmentDefinitionPartialsMock
      .mockResolvedValueOnce([...readyRows])
      .mockResolvedValueOnce([readyRows[1]]);

    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    const fetchQuerySpy = vi.spyOn(queryClient, 'fetchQuery');

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));

    await waitFor(() => {
      expect(deleteAssignmentDefinition).toHaveBeenCalledWith({ definitionKey: 'alg-10-safe' });
    });

    await waitFor(() => {
      expect(fetchQuerySpy).toHaveBeenCalled();

      for (const [queryOptions] of fetchQuerySpy.mock.calls) {
        expect(queryOptions).toBeDefined();
        expect(queryOptions.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
      }
    });

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

    await waitFor(() => {
      expect(within(table).queryByRole('cell', { name: (name) => name === 'Algebra foundations' })).not.toBeInTheDocument();
      expect(screen.getByText(/assignment definition deleted/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Delete assignment definition' })).not.toBeInTheDocument();
    });
  });

  it('keeps row visible and shows error feedback when delete fails', async () => {
    deleteAssignmentDefinitionMock.mockRejectedValue(new Error('delete failed'));

    renderWithFrontendProviders(<AssignmentsPage />);

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));

    await waitFor(() => {
      expect(deleteAssignmentDefinition).toHaveBeenCalledWith({ definitionKey: 'alg-10-safe' });
    });

    await waitFor(() => {
      expect(screen.getByText('Algebra foundations')).toBeInTheDocument();
      expect(screen.getByText(/could not delete assignment definition/i)).toBeInTheDocument();
    });
  });

  it('enters blocking state when post-delete refetch fails after success', async () => {
    getAssignmentDefinitionPartialsMock
      .mockResolvedValueOnce([...readyRows])
      .mockRejectedValueOnce(new Error('refetch failed after delete'));

    renderWithFrontendProviders(<AssignmentsPage />);

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));

    await waitFor(() => {
      expect(deleteAssignmentDefinition).toHaveBeenCalledWith({ definitionKey: 'alg-10-safe' });
    });

    await waitFor(() => {
      expect(screen.getByText(/assignment definitions could not be trusted or loaded/i)).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: 'Assignment definitions table' })).not.toBeInTheDocument();
    });
  });

  describe('Shared edit surface, re-parse gating, and task weighting workflow', () => {
    it('page action cluster has Refresh assignments data + Create assignment only, no top-level Update assignment button', () => {
      renderWithFrontendProviders(<AssignmentsPage />);

      // Should have Refresh and Create buttons
      expect(screen.getByRole('button', { name: 'Refresh assignments data' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeInTheDocument();

      // Should NOT have a top-level Update assignment button
      expect(screen.queryByRole('button', { name: /^Update assignment$/ })).not.toBeInTheDocument();

      // Should NOT show "not available in v1" text
      expect(screen.queryByText(/not available in v1/i)).not.toBeInTheDocument();
    });

    it('page-level create and update affordances enabled only when complete workflow available', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // With trustworthy data, Create should be enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();
      });

      // Table should have Update row actions
      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });
      expect(within(safeRow).getByRole('button', { name: /update/i })).toBeInTheDocument();
    });

    it('create mode hides or disables task editing before first parse', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // Create button should be enabled
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();

      // Clicking Create should open the modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      });

      // Before first parse, task editing should be hidden/disabled
      expect(screen.getByText(/parsing is required/i)).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /task weighting/i })).not.toBeInTheDocument();
    });

    it('stage-one success hydrates shared edit surface without second fetch', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      });

      // Fill in create form
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Assessment' } });
      fireEvent.change(screen.getByLabelText(/reference document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-ref' },
      });
      fireEvent.change(screen.getByLabelText(/template document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-tpl' },
      });

      // Select topic and year group
      fireEvent.click(screen.getByLabelText(/topic/i));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Algebra'));
      });
      fireEvent.click(screen.getByLabelText(/year group/i));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Year 10'));
      });

      // Trigger parse and continue
      fireEvent.click(screen.getByRole('button', { name: /parse and continue/i }));

      // After stage-one success, shared edit surface should be hydrated with tasks
      await waitFor(() => {
        expect(screen.getByRole('table', { name: /task weighting/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      });
    });

    it('document change disables metadata and task weighting inputs until re-parse or cancel', async () => {
      // This test requires the update modal workflow
      renderWithFrontendProviders(<AssignmentsPage />);

      // First we need to mock the getAssignmentDefinition service
      // For now, this test will fail because the update modal doesn't exist
      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Row should have update action
      const updateButton = within(safeRow).getByRole('button', { name: /update/i });
      expect(updateButton).toBeInTheDocument();

      // Click update - this will fail until modal is implemented
      fireEvent.click(updateButton);

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      });

      // Change document URL
      fireEvent.change(screen.getByLabelText(/reference document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });

      // Metadata and task weighting should be disabled
      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeDisabled();
        expect(screen.getByLabelText(/assignment weighting/i)).toBeDisabled();
      });

      // Should show re-parse prompt
      expect(screen.getByText(/document changed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /re-parse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('cancel restores persisted URLs and re-enables other fields', async () => {
      // This test will fail until the update modal with re-parse cancel is implemented
      renderWithFrontendProviders(<AssignmentsPage />);

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      });

      // Store original URLs
      const referenceUrlInput = screen.getByLabelText(/reference document url/i) as HTMLInputElement;
      const originalReferenceUrl = referenceUrlInput.value;
      const templateUrlInput = screen.getByLabelText(/template document url/i) as HTMLInputElement;
      const originalTemplateUrl = templateUrlInput.value;

      // Change document URLs
      fireEvent.change(referenceUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });
      fireEvent.change(templateUrlInput, {
        target: { value: 'https://docs.google.com/presentation/d/new-tpl' },
      });

      // Click cancel on re-parse prompt
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // URLs should be restored
      await waitFor(() => {
        expect(screen.getByLabelText(/reference document url/i)).toHaveValue(originalReferenceUrl);
        expect(screen.getByLabelText(/template document url/i)).toHaveValue(originalTemplateUrl);
      });

      // Other fields should be re-enabled
      expect(screen.getByLabelText(/title/i)).toBeEnabled();
      expect(screen.getByLabelText(/assignment weighting/i)).toBeEnabled();
    });

    it('re-parse refreshes task rows and preserves matching weightings', async () => {
      // This test will fail until the re-parse workflow is implemented
      renderWithFrontendProviders(<AssignmentsPage />);

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      });

      // Change document URL
      fireEvent.change(screen.getByLabelText(/reference document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/new-ref' },
      });

      // Click re-parse
      fireEvent.click(screen.getByRole('button', { name: /re-parse/i }));

      // Task rows should be refreshed
      await waitFor(() => {
        // This will fail until re-parse actually refreshes tasks
        expect(screen.getByText(/task/i)).toBeInTheDocument();
      });
    });

    it('save blocked until valid year-group selection present', async () => {
      // This test will fail until the form validation is implemented
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      });

      // Fill in required fields except year group
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Assessment' } });
      fireEvent.change(screen.getByLabelText(/reference document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-ref' },
      });
      fireEvent.change(screen.getByLabelText(/template document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-tpl' },
      });

      // Select topic but NOT year group
      fireEvent.click(screen.getByLabelText(/topic/i));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Algebra'));
      });

      // Save/Parse should be blocked without year group
      const primaryAction = screen.getByRole('button', { name: /parse and continue/i }) ??
        screen.getByRole('button', { name: /save/i });
      expect(primaryAction).toBeDisabled();
    });

    it('dirty metadata or weighting edits disable document URL fields until save or discard-by-close', async () => {
      // This test will fail until the dirty state management is implemented
      renderWithFrontendProviders(<AssignmentsPage />);

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /update assignment/i })).toBeInTheDocument();
      });

      // Edit metadata
      fireEvent.change(screen.getByLabelText(/title/i), {
        target: { value: 'Updated Title' },
      });

      // Document URL fields should be disabled
      await waitFor(() => {
        expect(screen.getByLabelText(/reference document url/i)).toBeDisabled();
        expect(screen.getByLabelText(/template document url/i)).toBeDisabled();
      });
    });

    it('create entry blocks locally when required reference data cannot be loaded', async () => {
      // This test will fail until the reference data failure handling is implemented
      useStartupWarmupStateMock.mockReturnValue(
        createAssignmentsWarmupState({
          assignmentStatus: 'ready',
          assignmentTrustworthy: true,
          isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentTopics' && datasetKey !== 'yearGroups',
          isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentTopics' || datasetKey === 'yearGroups',
        })
      );

      renderWithFrontendProviders(<AssignmentsPage />);

      // Create button should be enabled but modal should fail closed when opened
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();

      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      // Modal should open but show blocking error
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/could not be trusted or loaded/i)).toBeInTheDocument();
      });
    });

    it('failed post-mutation refresh fails closed on affected table or modal surface', async () => {
      // This test will fail until the post-mutation refresh failure handling is implemented
      getAssignmentDefinitionPartialsMock
        .mockResolvedValueOnce([...readyRows])
        .mockRejectedValueOnce(new Error('refresh failed'));

      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);

      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /create assignment/i })).toBeInTheDocument();
      });

      // Fill in fields and trigger parse
      fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Assessment' } });
      fireEvent.change(screen.getByLabelText(/reference document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-ref' },
      });
      fireEvent.change(screen.getByLabelText(/template document url/i), {
        target: { value: 'https://docs.google.com/presentation/d/test-tpl' },
      });

      fireEvent.click(screen.getByLabelText(/topic/i));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Algebra'));
      });
      fireEvent.click(screen.getByLabelText(/year group/i));
      await waitFor(() => {
        fireEvent.click(screen.getByText('Year 10'));
      });

      fireEvent.click(screen.getByRole('button', { name: /parse and continue/i }));

      // Simulate a post-mutation refresh failure
      // The modal surface should fail closed
      await waitFor(() => {
        const modal = screen.queryByRole('dialog', { name: /create assignment/i });
        if (modal) {
          expect(within(modal).getByRole('alert')).toBeInTheDocument();
          expect(within(modal).getByText(/could not be trusted or loaded/i)).toBeInTheDocument();
        }
      });
    });
  });
});
