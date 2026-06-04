import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import {
  createReadyStartupWarmupState,
} from '../../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  mockFullAssignmentDefinition,
  mockUpsertResponse,
  readyAssignmentPartialRows,
} from '../../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { AssignmentsPage } from '../AssignmentsPage';
import {
  applyColumnFilterOption,
  filterAssertions,
  filterRows,
  expectedFilterNamesByColumn,
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

  it.each(filterAssertions)(
    'applies exact-value filter "$filterButtonName" option "$optionLabel" and reset restores defaults',
    async (filterAssertion) => {
      getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);

      renderWithFrontendProviders(<AssignmentsPage />);

      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });

      await applyColumnFilterOption(filterAssertion.filterButtonName, filterAssertion.optionLabel);

      await waitFor(() => {
        expect(
          within(table).getByText(filterAssertion.expectedVisibleRow, { exact: true })
        ).toBeInTheDocument();
        expect(
          within(table).queryByText(filterAssertion.expectedHiddenRow, { exact: true })
        ).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));

      await waitFor(() => {
        expect(
          within(table).getByText(filterAssertion.expectedHiddenRow, { exact: true })
        ).toBeInTheDocument();
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

      expect(
        within(columnHeader).getByRole('button', {
          name: expectedFilterNameByColumn.filterButtonName,
        })
      ).toBeInTheDocument();
    }
  });
});
