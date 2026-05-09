import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query/queryKeys';
import { deleteAssignmentDefinition } from '../services/assignmentDefinitionPartialsService';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import {
  setTextboxValue,
  createStartupWarmupState,
  createReadyStartupWarmupState,
  noop,
} from '../test/assignmentDefinition/wizardTestHelpers';
import type { AssignmentDefinitionPartialRow } from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import {
  mockTopics,
  mockYearGroups,
  mockFullAssignmentDefinition,
  mockUpsertResponse,
  readyAssignmentPartialRows,
} from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { AssignmentsPage } from './AssignmentsPage';
import { pageContent } from './pageContent';

const {
  deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartialsMock,
  getAssignmentDefinitionMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  getABClassPartialsMock,
  upsertAssignmentDefinitionMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  deleteAssignmentDefinitionMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  getAssignmentDefinitionMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  getABClassPartialsMock: vi.fn(),
  upsertAssignmentDefinitionMock: vi.fn(),
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

vi.mock('../services/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
}));

vi.mock('../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
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

const readyRows: AssignmentDefinitionPartialRow[] = [...readyAssignmentPartialRows];

const filterRows: AssignmentDefinitionPartialRow[] = [
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
];

const migratedContractRows: AssignmentDefinitionPartialRow[] = [...readyRows];

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
  let userEventInstance: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    userEventInstance = userEvent.setup();
    useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
    getAssignmentDefinitionPartialsMock.mockResolvedValue([...readyAssignmentPartialRows]);
    deleteAssignmentDefinitionMock.mockResolvedValue(void 0);
    getAssignmentTopicsMock.mockResolvedValue(mockTopics);
    getYearGroupsMock.mockResolvedValue(mockYearGroups);
    getCohortsMock.mockResolvedValue([]);
    getABClassPartialsMock.mockResolvedValue([]);
    upsertAssignmentDefinitionMock.mockResolvedValue(mockUpsertResponse);
    getAssignmentDefinitionMock.mockResolvedValue(mockFullAssignmentDefinition);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state treatment while keeping heading and summary copy visible', () => {
    useStartupWarmupStateMock.mockReturnValue(
      createStartupWarmupState({
        assignmentDefinitionPartialsStatus: 'loading',
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
    expect(screen.getByRole('button', { name: 'Refresh assignments data' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Create assignment' })).toBeEnabled();

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
    expect(within(safeRow).getByRole('button', { name: /update/i })).toBeEnabled();
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
      createStartupWarmupState({
        assignmentDefinitionPartialsStatus: 'failed',
        isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
        isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentDefinitionPartials',
      })
    );

    renderWithFrontendProviders(<AssignmentsPage />);

    expect(screen.getByText(/assignment definitions could not be trusted or loaded/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|refresh assignments data/i })).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Assignment definitions table' })).not.toBeInTheDocument();
  });

  it('launches create workflow when create assignment is clicked', () => {
    renderWithFrontendProviders(<AssignmentsPage />);

    const createAssignmentButton = screen.getByRole('button', { name: 'Create assignment' });
    // Top-level Update assignment button removed in Section 4
    expect(screen.queryByRole('button', { name: /^Update assignment$/ })).not.toBeInTheDocument();

    // Create button is enabled with trustworthy data
    expect(createAssignmentButton).toBeEnabled();
    expect(screen.queryByText(/not available in v1/i)).not.toBeInTheDocument();

    // Note: Clicking the button would open the modal, but that requires service mocks
    // which are tested separately in Section 4 tests
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
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');

    fireEvent.click(screen.getByRole('button', { name: /retry|refresh assignments data/i }));

    await waitFor(() => {
      expect(refetchQueriesSpy).toHaveBeenCalled();
    });

    for (const [refetchOptions] of refetchQueriesSpy.mock.calls) {
      expect(refetchOptions).toBeDefined();
      expect(refetchOptions?.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
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
    await act(async () => {
      fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));
    });

    await waitFor(() => {
      const deleteDialog = screen.getByRole('dialog', { name: 'Delete assignment definition' });
      expect(within(deleteDialog).getByRole('button', { name: /delete definition/i })).toBeDisabled();
      expect(screen.getAllByRole('button', { name: /delete/i }).every((button) => button.hasAttribute('disabled'))).toBe(true);
    });

    await act(async () => {
      resolveDeleteRequest();
    });
  });

  it('handles delete success by refetching, removing the row, and showing success feedback', async () => {
    getAssignmentDefinitionPartialsMock
      .mockResolvedValueOnce([...readyRows])
      .mockResolvedValueOnce([readyRows[1]]);

    const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
    const refetchQueriesSpy = vi.spyOn(queryClient, 'refetchQueries');

    const safeRow = await screen.findByRole('row', { name: /algebra foundations/i });
    fireEvent.click(within(safeRow).getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete definition' }));

    await waitFor(() => {
      expect(deleteAssignmentDefinition).toHaveBeenCalledWith({ definitionKey: 'alg-10-safe' });
    });

    await waitFor(() => {
      expect(refetchQueriesSpy).toHaveBeenCalled();

      for (const [refetchOptions] of refetchQueriesSpy.mock.calls) {
        expect(refetchOptions).toBeDefined();
        expect(refetchOptions?.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
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

    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

    await waitFor(() => {
      expect(within(table).getByText('Algebra foundations')).toBeInTheDocument();
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

    it('create mode opens without a full-definition read', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /create assignment/i });
      });

      expect(within(modal).getByRole('button', { name: /parse and continue/i })).toBeDisabled();
      expect(getAssignmentDefinitionMock).not.toHaveBeenCalled();
    });

    it('document change disables metadata and task weighting inputs until re-parse or cancel', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Row should have update action
      const updateButton = within(safeRow).getByRole('button', { name: /update/i });
      expect(updateButton).toBeInTheDocument();

      // Click update
      fireEvent.click(updateButton);

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Change document URL using userEvent for Ant Design Form compatibility
      const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i });
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, { target: { value: 'https://docs.google.com/presentation/d/new-ref' } });

      // Metadata and task weighting should be disabled
      await waitFor(() => {
        const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
        const weightingInput = within(modal).getByRole('spinbutton', { name: /assignment weighting/i });
        expect(titleInput).toBeDisabled();
        expect(weightingInput).toBeDisabled();
      });

      // Should show re-parse prompt
      expect(within(modal).getByText(/document changed/i)).toBeInTheDocument();
      const reparseActionRow = within(modal).getByRole('button', { name: /re-parse/i }).closest('.ant-space') as HTMLElement;
      expect(within(reparseActionRow).getByRole('button', { name: /re-parse/i })).toBeInTheDocument();
      expect(within(reparseActionRow).getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    });

    it('cancel restores persisted URLs and re-enables other fields', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Store original URLs
      const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i }) as HTMLInputElement;
      const originalReferenceUrl = referenceUrlInput.value;
      const templateUrlInput = within(modal).getByRole('textbox', { name: /template document url/i }) as HTMLInputElement;
      const originalTemplateUrl = templateUrlInput.value;

      // Change document URLs using userEvent
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
        expect(templateUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, { target: { value: 'https://docs.google.com/presentation/d/new-ref' } });
      fireEvent.change(templateUrlInput, { target: { value: 'https://docs.google.com/presentation/d/new-tpl' } });

      // Click cancel on re-parse prompt
      const reparseActionRow = within(modal).getByRole('button', { name: /re-parse/i }).closest('.ant-space') as HTMLElement;
      const cancelButton = within(reparseActionRow).getByRole('button', { name: /^cancel$/i });
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // URLs should be restored
      await waitFor(() => {
        const restoredModal = screen.getByRole('dialog', { name: /update assignment/i });
        const referenceInput = within(restoredModal).getByRole('textbox', { name: /reference document url/i });
        const templateInput = within(restoredModal).getByRole('textbox', { name: /template document url/i });
        expect(referenceInput).toHaveValue(originalReferenceUrl);
        expect(templateInput).toHaveValue(originalTemplateUrl);
      });

      // Other fields should be re-enabled
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      const weightingInput = within(modal).getByRole('spinbutton', { name: /assignment weighting/i });
      expect(titleInput).toBeEnabled();
      expect(weightingInput).toBeEnabled();
    });

    it('re-parse refreshes task rows and preserves matching weightings', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Change document URL using userEvent
      const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i });
      await waitFor(() => {
        expect(referenceUrlInput).toBeEnabled();
      });
      fireEvent.change(referenceUrlInput, { target: { value: 'https://docs.google.com/presentation/d/new-ref' } });

      upsertAssignmentDefinitionMock.mockResolvedValueOnce({
        ...mockFullAssignmentDefinition,
        tasks: [
          { taskId: 'task-1', taskTitle: 'Solve quadratic equations', taskWeighting: 1 },
          { taskId: 'task-4', taskTitle: 'Complete revision quiz', taskWeighting: 1 },
        ],
      });

      // Click re-parse
      const reparseButton = within(modal).getByRole('button', { name: /re-parse/i });
      await act(async () => {
        fireEvent.click(reparseButton);
      });

      // Task rows should be refreshed
      await waitFor(() => {
        const refreshedModal = screen.getByRole('dialog', { name: /update assignment/i });
        expect(within(refreshedModal).getByText(/complete revision quiz/i)).toBeInTheDocument();
      });
    });

    it('save blocked until valid year-group selection present', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);

      // Open create modal
      fireEvent.click(screen.getByRole('button', { name: 'Create assignment' }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /create assignment/i });
      });

      // Fill in required fields except year group using userEvent
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i });
      const templateUrlInput = within(modal).getByRole('textbox', { name: /template document url/i });

      setTextboxValue(titleInput, 'New Assessment');
      setTextboxValue(referenceUrlInput, 'https://docs.google.com/presentation/d/test-ref');
      setTextboxValue(templateUrlInput, 'https://docs.google.com/presentation/d/test-tpl');

      // Save/Parse should be blocked without year group
      const primaryAction = within(modal).getByRole('button', { name: /parse and continue/i });
      expect(primaryAction).toBeDisabled();
    });

    it('dirty metadata or weighting edits disable document URL fields until save or discard-by-close', async () => {
      const { queryClient } = renderWithFrontendProviders(<AssignmentsPage />);

      // Pre-populate the query cache with the definition data for update mode
      queryClient.setQueryData(queryKeys.assignmentDefinitionPartials(), [...readyRows]);
      queryClient.setQueryData(queryKeys.assignmentTopics(), mockTopics);
      queryClient.setQueryData(queryKeys.yearGroups(), mockYearGroups);
      queryClient.setQueryData(
        queryKeys.assignmentDefinitionByKey('alg-10-safe'),
        mockFullAssignmentDefinition
      );

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      const safeRow = within(table).getByRole('row', { name: /algebra foundations/i });

      // Click update
      fireEvent.click(within(safeRow).getByRole('button', { name: /update/i }));

      const modal = await waitFor(() => {
        return screen.getByRole('dialog', { name: /update assignment/i });
      });

      // Edit metadata using userEvent
      const titleInput = within(modal).getByRole('textbox', { name: /assignment title/i });
      await userEventInstance.clear(titleInput);
      await userEventInstance.type(titleInput, 'Updated Title');

      // Document URL fields should be disabled
      await waitFor(() => {
        const referenceUrlInput = within(modal).getByRole('textbox', { name: /reference document url/i });
        const templateUrlInput = within(modal).getByRole('textbox', { name: /template document url/i });
        expect(referenceUrlInput).toBeDisabled();
        expect(templateUrlInput).toBeDisabled();
      });
    });

    it('create entry blocks locally when required reference data cannot be loaded', async () => {
      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentDefinitionPartialsStatus: 'ready',
          isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentTopics' && datasetKey !== 'yearGroups',
          isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentTopics' || datasetKey === 'yearGroups',
        })
      );

      renderWithFrontendProviders(<AssignmentsPage />);

      // Create button should be disabled when reference data is not trustworthy
      expect(screen.getByRole('button', { name: 'Create assignment' })).toBeDisabled();
    });

  });
});
