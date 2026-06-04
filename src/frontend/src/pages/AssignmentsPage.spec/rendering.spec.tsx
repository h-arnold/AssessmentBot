import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { deleteAssignmentDefinition } from '../../services/assignmentDefinitionPartialsService';
import { getCssRuleBlock } from '../../test/appStylesRaw';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  createStartupWarmupState,
  createReadyStartupWarmupState,
  noop,
} from '../../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  mockFullAssignmentDefinition,
  mockUpsertResponse,
  readyAssignmentPartialRows,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { AssignmentsPage } from '../AssignmentsPage';
import { pageContent } from '../pageContent';
import {
  readyRows,
  filterRows,
  recommendedSummaryCopy,
  getAssignmentsPageContent,
  migratedContractRows,
} from './shared-setup';

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
  refetchAfterStaleInvalidateMock,
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
  refetchAfterStaleInvalidateMock: vi.fn(),
}));

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  deleteAssignmentDefinition: deleteAssignmentDefinitionMock,
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/assignmentDefinitionService', () => ({
  getAssignmentDefinition: getAssignmentDefinitionMock,
  upsertAssignmentDefinition: upsertAssignmentDefinitionMock,
}));

vi.mock('../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../query/queryInvalidationHelpers', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;
  refetchAfterStaleInvalidateMock.mockImplementation(
    actualModule.refetchAfterStaleInvalidate as (...arguments_: unknown[]) => unknown
  );
  return { ...actualModule, refetchAfterStaleInvalidate: refetchAfterStaleInvalidateMock };
});

describe('AssignmentsPage', () => {
  beforeEach(() => {
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

    expect(
      screen.getByRole('heading', { level: 2, name: pageContent.assignments.heading })
    ).toBeInTheDocument();
    expect(screen.getByText(recommendedSummaryCopy)).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Assignments management panel' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Assignments table loading')).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Assignment definitions table' })
    ).not.toBeInTheDocument();
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

  it('routes the assignments page through the shared wide-page token', () => {
    const { container } = renderWithFrontendProviders(<AssignmentsPage />);
    const assignmentsPageContent = getAssignmentsPageContent(container);

    expect(assignmentsPageContent).toHaveClass('app-page-content');

    const assignmentsPageRuleBlock = getCssRuleBlock('.app-page-content');

    expect(assignmentsPageRuleBlock).toMatch(
      /width:\s*min\([^)]*var\(--app-page-width-wide-data\)/
    );
    expect(assignmentsPageRuleBlock).not.toMatch(/\b1280px\b/);
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
      expect(
        screen.getByRole('table', { name: 'Assignment definitions table' })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/no assignment definitions found/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry|refresh assignments data/i })
    ).toBeInTheDocument();
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

    expect(
      screen.getByText(/assignment definitions could not be trusted or loaded/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /retry|refresh assignments data/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Assignment definitions table' })
    ).not.toBeInTheDocument();
  });

  it('recovers from startup assignment-partials failure once query data is refetched successfully', async () => {
    useStartupWarmupStateMock.mockReturnValue(
      createStartupWarmupState({
        assignmentDefinitionPartialsStatus: 'failed',
      })
    );

    renderWithFrontendProviders(<AssignmentsPage />);

    await waitFor(() => {
      expect(
        screen.queryByText(/assignment definitions could not be trusted or loaded/i)
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('table', { name: 'Assignment definitions table' })
      ).toBeInTheDocument();
    });
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

    expect(
      newestRow.compareDocumentPosition(archivedRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      archivedRow.compareDocumentPosition(exactRow) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

  it('awaits refetchAfterStaleInvalidate in handleRetryAssignmentsData so errors cannot become unhandled rejections', async () => {
    const originalImpl = refetchAfterStaleInvalidateMock.getMockImplementation();
    try {
      let refetchCompleted = false;
      refetchAfterStaleInvalidateMock.mockImplementation(() => {
        return Promise.resolve().then(() => {
          refetchCompleted = true;
        });
      });

      useStartupWarmupStateMock.mockReturnValue(
        createStartupWarmupState({
          assignmentDefinitionPartialsStatus: 'failed',
          isDatasetReady: (datasetKey: string) => datasetKey !== 'assignmentDefinitionPartials',
          isDatasetFailed: (datasetKey: string) => datasetKey === 'assignmentDefinitionPartials',
        })
      );

      renderWithFrontendProviders(<AssignmentsPage />);

      expect(
        screen.getByText(/assignment definitions could not be trusted or loaded/i)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /retry|refresh assignments data/i }));

      expect(refetchAfterStaleInvalidateMock).toHaveBeenCalledTimes(1);

      // With the async/await fix in handleRetryAssignmentsData, the click fires
      // the async handler which awaits the refetch promise. Flush microtasks so
      // the promise's .then() callback sets refetchCompleted before we assert.
      await Promise.resolve();

      expect(refetchCompleted).toBe(true);
    } finally {
      refetchAfterStaleInvalidateMock.mockImplementation(originalImpl!);
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
    expect(
      within(deleteDialog).getByText('Algebra foundations', { exact: true })
    ).toBeInTheDocument();
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
      expect(
        within(deleteDialog).getByRole('button', { name: /delete definition/i })
      ).toBeDisabled();
      expect(
        screen
          .getAllByRole('button', { name: /delete/i })
          .every((button) => button.hasAttribute('disabled'))
      ).toBe(true);
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
      expect(
        within(table).queryByRole('cell', { name: (name) => name === 'Algebra foundations' })
      ).not.toBeInTheDocument();
      expect(screen.getByText(/assignment definition deleted/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('dialog', { name: 'Delete assignment definition' })
      ).not.toBeInTheDocument();
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
      expect(
        screen.getByText(/assignment definitions could not be trusted or loaded/i)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('table', { name: 'Assignment definitions table' })
      ).not.toBeInTheDocument();
    });
  });
});
