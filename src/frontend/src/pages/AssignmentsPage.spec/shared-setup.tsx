/* eslint-disable react-refresh/only-export-components */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AssignmentDefinition } from '../../services/assignmentDefinition.zod';

type AssignmentDefinitionPartialRow = Pick<
  AssignmentDefinition,
  | 'definitionKey'
  | 'primaryTitle'
  | 'primaryTopicKey'
  | 'primaryTopic'
  | 'yearGroupKey'
  | 'yearGroupLabel'
  | 'alternateTitles'
  | 'alternateTopics'
  | 'documentType'
  | 'referenceDocumentId'
  | 'templateDocumentId'
  | 'assignmentWeighting'
  | 'tasks'
  | 'createdAt'
  | 'updatedAt'
>;

const readyAssignmentPartialRows: AssignmentDefinitionPartialRow[] = [
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
    tasks: [],
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
    assignmentWeighting: 1,
    definitionKey: 'legacy/unsafe-key',
    tasks: [],
    createdAt: '2025-01-16T08:00:00.000Z',
    updatedAt: null,
  },
];

const recommendedSummaryCopy =
  'Review assignment-definition partials and remove obsolete definitions without loading full task data.';

/**
 * Returns the shared Assignments page content wrapper.
 *
 * @param {HTMLElement} container The rendered test container.
 * @returns {HTMLElement} The shared Assignments page content wrapper.
 */
function getAssignmentsPageContent(container: HTMLElement) {
  const assignmentsPageContent = container.querySelector('.app-page-content');

  if (!(assignmentsPageContent instanceof HTMLElement)) {
    throw new TypeError('Expected the shared assignments page content wrapper to render.');
  }

  return assignmentsPageContent;
}

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

export {
  type AssignmentDefinitionPartialRow,
  applyColumnFilterOption,
  expectedFilterNamesByColumn,
  filterAssertions,
  filterRows,
  getAssignmentsPageContent,
  migratedContractRows,
  readyRows,
  recommendedSummaryCopy,
};
