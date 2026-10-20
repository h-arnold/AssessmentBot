import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { buildClassesManagementState } from '@/test/classes/classesTestHelpers';
import { queryKeys } from '@/query/queryKeys';
import { ClassesManagementPanel } from './ClassesManagementPanel';
import type { ClassesManagementState } from './useClassesManagement';
import type * as ReferenceDataService from '@/services/referenceData/referenceDataService';

const { useClassesManagementMock, useClassesBulkMutationQueueMock, runQueuedBatchMutationMock } =
  vi.hoisted(() => {
    return {
      useClassesManagementMock: vi.fn(),
      useClassesBulkMutationQueueMock: vi.fn(),
      runQueuedBatchMutationMock: vi.fn(),
    };
  });

vi.mock('@/features/classes/useClassesManagement', () => {
  return {
    useClassesManagement: useClassesManagementMock,
  };
});
vi.mock('@/features/classes/useClassesBulkMutationQueue', () => {
  return {
    useClassesBulkMutationQueue: useClassesBulkMutationQueueMock,
  };
});
vi.mock('@/features/classes/bulk/runQueuedBatchMutation', () => {
  return {
    runQueuedBatchMutation: runQueuedBatchMutationMock,
  };
});
vi.mock('@/services/referenceData/referenceDataService', async (importOriginal) => {
  const original = await importOriginal<typeof ReferenceDataService>();
  return {
    ...original,
    getCohorts: async () => [],
    getYearGroups: async () => [],
  };
});

const cohorts = [
  { key: 'cohort-2025', name: 'Cohort 2025', active: true, startYear: 2025, startMonth: 9 },
];
const yearGroups = [{ key: 'year-10', name: 'Year 10' }];
const EXPECTED_MODAL_COUNT = 2;

/**
 * Creates query state for reference-data modal fields.
 * @returns {QueryClient} Query client containing the cohort and year-group fixtures.
 */
function makeQueryClient(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(queryKeys.cohorts(), cohorts);
  queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  return queryClient;
}

/**
 * Opens the real bulk-create modal inside the panel.
 * @returns {Promise<{ createDialog: HTMLElement; user: ReturnType<typeof userEvent.setup> }>} The open dialog and its user-event instance.
 */
async function openCreateModal(): Promise<{
  createDialog: HTMLElement;
  user: ReturnType<typeof userEvent.setup>;
}> {
  const user = userEvent.setup();
  renderWithFrontendProviders(<ClassesManagementPanel />, {
    queryClient: makeQueryClient(),
  });
  await user.click(screen.getByRole('button', { name: 'Create ABClass' }));
  const createDialog = await screen.findByRole('dialog', { name: 'Create ABClass' });
  return { createDialog, user };
}

/**
 * Selects one Add new command from a real Ant Design Select.
 * @param {ReturnType<typeof userEvent.setup>} user User-event instance for the interaction.
 * @param {'Cohort' | 'Year group'} fieldName Accessible label of the Select field.
 * @param {'Add new cohort' | 'Add new year group'} optionName Accessible label of its Add new option.
 * @returns {Promise<void>} Resolves after selecting the command.
 */
async function selectAddNew(
  user: ReturnType<typeof userEvent.setup>,
  fieldName: 'Cohort' | 'Year group',
  optionName: 'Add new cohort' | 'Add new year group'
): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: fieldName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

/**
 * Finds a visible modal by its rendered title, avoiding rc-component's shared test-only ID.
 * @param {string} title Visible modal heading.
 * @returns {HTMLElement} Matching dialog element.
 */
function getDialogByVisibleTitle(title: string): HTMLElement {
  const dialog = screen
    .getAllByRole('dialog')
    .find((candidate) => within(candidate).queryByText(title, { selector: '.ant-modal-title' }));
  expect(dialog).toBeDefined();
  return dialog as HTMLElement;
}

beforeEach(() => {
  useClassesManagementMock.mockReturnValue(
    buildClassesManagementState({
      cohorts,
      selectedRowKeys: ['not-created-1'],
      yearGroups,
    } satisfies Partial<ClassesManagementState>)
  );
  useClassesBulkMutationQueueMock.mockReturnValue({
    isQueueActive: false,
    isProgressModalOpen: false,
    progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
    onDismissProgressModal: vi.fn(),
    onCancelQueue: vi.fn(),
    runQueuedBulkAction: vi.fn(),
  });
  runQueuedBatchMutationMock.mockReset();
});

describe('ClassesManagementPanel Add new managers', () => {
  it('opens the real cohort manager over the still-open create modal', async () => {
    const { createDialog, user } = await openCreateModal();

    await selectAddNew(user, 'Cohort', 'Add new cohort');

    expect(createDialog).toBeInTheDocument();
    expect(within(createDialog).queryByText('Add new cohort')).not.toBeInTheDocument();
    expect(within(createDialog).getByText('Select a cohort')).toBeInTheDocument();
    expect(
      await screen.findByText('Manage Cohorts', { selector: '.ant-modal-title' })
    ).toBeInTheDocument();
    expect(getDialogByVisibleTitle('Manage Cohorts')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(EXPECTED_MODAL_COUNT);
  });

  it('opens the real year-group manager over the still-open create modal', async () => {
    const { createDialog, user } = await openCreateModal();

    await selectAddNew(user, 'Year group', 'Add new year group');

    expect(createDialog).toBeInTheDocument();
    expect(within(createDialog).queryByText('Add new year group')).not.toBeInTheDocument();
    expect(within(createDialog).getByText('Select a year group')).toBeInTheDocument();
    expect(
      await screen.findByText('Manage Year Groups', { selector: '.ant-modal-title' })
    ).toBeInTheDocument();
    expect(getDialogByVisibleTitle('Manage Year Groups')).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(EXPECTED_MODAL_COUNT);
  });

  it('repeated cohort selection leaves one visible cohort manager', async () => {
    const { createDialog, user } = await openCreateModal();

    await selectAddNew(user, 'Cohort', 'Add new cohort');
    await screen.findByText('Manage Cohorts', { selector: '.ant-modal-title' });
    const manager = getDialogByVisibleTitle('Manage Cohorts');
    // The scaffold uses Ant Design's accessible close button; exercise that real control.
    await user.click(within(manager).getByRole('button', { name: /close/i }));
    // The test CSS stub has no transition stylesheet to finish CSSMotion's exit.
    await waitFor(() => expect(manager).toHaveClass('ant-zoom-leave'));
    expect(createDialog).toBeInTheDocument();
    expect(within(createDialog).queryByText('Add new cohort')).not.toBeInTheDocument();
    expect(within(createDialog).getByText('Select a cohort')).toBeInTheDocument();
    await selectAddNew(user, 'Cohort', 'Add new cohort');

    expect(createDialog).toBeInTheDocument();
    expect(within(createDialog).queryByText('Add new cohort')).not.toBeInTheDocument();
    expect(within(createDialog).getByText('Select a cohort')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('dialog')
        .filter((dialog) =>
          within(dialog).queryByText('Manage Cohorts', { selector: '.ant-modal-title' })
        )
    ).toHaveLength(1);
    expect(screen.getAllByRole('dialog')).toHaveLength(EXPECTED_MODAL_COUNT);
  });
});
