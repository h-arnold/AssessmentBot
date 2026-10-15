import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { createReadyStartupWarmupState } from '../test/assignmentDefinition/wizardTestHelpers';
import {
  mockTopics,
  mockYearGroups,
  readyAssignmentPartialRows,
} from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import type { AssignmentDefinitionPartialRow } from '../test/assignmentDefinition/assignmentDefinitionTestFixtures';
import { AssignmentsPage } from './AssignmentsPage';

const {
  getAssignmentDefinitionPartialsMock,
  getAssignmentTopicsMock,
  getCohortsMock,
  getYearGroupsMock,
  getABClassPartialsMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => {
  return {
    getAssignmentDefinitionPartialsMock: vi.fn(),
    getAssignmentTopicsMock: vi.fn(),
    getCohortsMock: vi.fn(),
    getYearGroupsMock: vi.fn(),
    getABClassPartialsMock: vi.fn(),
    useStartupWarmupStateMock: vi.fn(),
  };
});
vi.mock('../features/auth/startupWarmupState', async (importOriginal) => {
  return {
    ...((await importOriginal()) as Record<string, unknown>),
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});
vi.mock('../services/assignmentDefinition/assignmentDefinitionPartialsService', () => {
  return {
    getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
  };
});
vi.mock('../services/assignmentDefinition/assignmentDefinitionService', () => {
  return {
    getAssignmentDefinition: vi.fn(),
    upsertAssignmentDefinition: vi.fn(),
  };
});
vi.mock('../services/assignmentDefinition/assignmentTopicsService', () => {
  return {
    getAssignmentTopics: getAssignmentTopicsMock,
  };
});
vi.mock('../services/referenceData/referenceDataService', () => {
  return {
    getCohorts: getCohortsMock,
    getYearGroups: getYearGroupsMock,
  };
});
vi.mock('../services/googleClassrooms/classPartialsService', () => {
  return {
    getABClassPartials: getABClassPartialsMock,
  };
});

const filterRows: AssignmentDefinitionPartialRow[] = [
  {
    ...readyAssignmentPartialRows[0],
    primaryTitle: 'Newest algebra recap',
    yearGroupKey: 'year-group-11',
    yearGroupLabel: 'Year 11',
    definitionKey: 'newest-safe',
    updatedAt: '2025-02-01T08:00:00.000Z',
  },
  {
    ...readyAssignmentPartialRows[0],
    primaryTitle: 'Algebra foundations',
    definitionKey: 'exact-match-safe',
    updatedAt: '2025-01-16T08:00:00.000Z',
  },
  {
    ...readyAssignmentPartialRows[0],
    primaryTitle: 'Algebra foundations archive',
    definitionKey: 'archive-safe',
    updatedAt: '2025-01-17T08:00:00.000Z',
  },
  { ...readyAssignmentPartialRows[1], definitionKey: 'unsafe/legacy-key' },
];
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
 * Applies a visible filter option and closes its popup.
 * @param {string} filterButtonName Accessible filter trigger name.
 * @param {string} optionLabel Visible option text.
 */
async function applyColumnFilterOption(filterButtonName: string, optionLabel: string) {
  fireEvent.click(screen.getByRole('button', { name: filterButtonName }));
  const popup = await waitFor(() => {
    const visible = [...document.body.querySelectorAll<HTMLElement>('.ant-dropdown')].filter(
      (item) => !item.classList.contains('ant-dropdown-hidden')
    );
    expect(visible.at(-Math.sign(visible.length))).toBeTruthy();
    return visible.at(-Math.sign(visible.length))!;
  });
  fireEvent.click(within(popup).getByText(optionLabel, { exact: true }));
  fireEvent.keyDown(document, { key: 'Escape' });
}

describe('AssignmentsPage table filtering', () => {
  beforeEach(() => {
    useStartupWarmupStateMock.mockReturnValue(createReadyStartupWarmupState());
    getAssignmentDefinitionPartialsMock.mockResolvedValue([...readyAssignmentPartialRows]);
    getAssignmentTopicsMock.mockResolvedValue(mockTopics);
    getYearGroupsMock.mockResolvedValue(mockYearGroups);
    getCohortsMock.mockResolvedValue([]);
    getABClassPartialsMock.mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('renders default sorted rows and unavailable markers for mixed assignment data', async () => {
    getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);
    renderWithFrontendProviders(<AssignmentsPage />);
    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
    expect(within(table).getAllByText('—').length).toBeGreaterThan(1);
    const newest = within(table).getByText('Newest algebra recap', { exact: true });
    const archived = within(table).getByText('Algebra foundations archive', { exact: true });
    const exact = within(table).getByText('Algebra foundations', { exact: true });
    expect(
      newest.compareDocumentPosition(archived) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(archived.compareDocumentPosition(exact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(filterAssertions)(
    'applies exact-value filter "$filterButtonName" option "$optionLabel" and reset restores defaults',
    async (assertion) => {
      getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);
      renderWithFrontendProviders(<AssignmentsPage />);
      const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
      await applyColumnFilterOption(assertion.filterButtonName, assertion.optionLabel);
      await waitFor(() => {
        expect(
          within(table).getByText(assertion.expectedVisibleRow, { exact: true })
        ).toBeInTheDocument();
        expect(
          within(table).queryByText(assertion.expectedHiddenRow, { exact: true })
        ).not.toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: 'Reset sort and filters' }));
      await waitFor(() => {
        return expect(
          within(table).getByText(assertion.expectedHiddenRow, { exact: true })
        ).toBeInTheDocument();
      }
      );
    }
  );

  it('keeps each filter trigger label bound to its column header', async () => {
    getAssignmentDefinitionPartialsMock.mockResolvedValue(filterRows);
    renderWithFrontendProviders(<AssignmentsPage />);
    const table = await screen.findByRole('table', { name: 'Assignment definitions table' });
    for (const expected of expectedFilterNamesByColumn) {
      const header = within(table).getByRole('columnheader', { name: expected.columnHeaderName });
      expect(
        within(header).getByRole('button', { name: expected.filterButtonName })
      ).toBeInTheDocument();
    }
  });
});
