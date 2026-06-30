/**
 * Bulk metadata failure handling — integration tests.
 *
 * Covers: all-failure metadata outcomes now showing a panel-level alert
 * (with shouldCloseModal: true) instead of an inline errorMessage inside
 * the modal. Partial-failure behaviour (panel alert, modal closes) is
 * preserved.
 */

import * as React from 'react';
import type { ReactElement } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import type * as BulkSetCohortFlowModule from './bulk/bulkSetCohortFlow';
import type * as BulkSetYearGroupFlowModule from './bulk/bulkSetYearGroupFlow';
import type * as BulkSetCourseLengthFlowModule from './bulk/bulkSetCourseLengthFlow';
import {
  activeCohortOptions,
  buildClassesManagementRow,
  buildClassesManagementState,
  yearGroupOptions,
} from '../../test/classes/classesTestHelpers';
import type { BatchProgressSnapshot } from './bulk/runQueuedBatchMutation';

const classesManagementStateMock = vi.fn();
const bulkSetCohortMock = vi.hoisted(() => vi.fn());
const bulkSetYearGroupMock = vi.hoisted(() => vi.fn());
const bulkSetCourseLengthMock = vi.hoisted(() => vi.fn());
const runQueuedBulkActionMock = vi.fn(
  async ({ mutate, onComplete }: { mutate: (onProgress: (snapshot: BatchProgressSnapshot) => void) => Promise<unknown[]>; onComplete: (results: unknown[]) => Promise<void> }) => {
    const results = await mutate(vi.fn());
    await onComplete(results);
  },
);

const UPDATED_COURSE_LENGTH = 6;

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./useClassesBulkMutationQueue', () => ({
  useClassesBulkMutationQueue: () => ({
    isQueueActive: false,
    progress: { currentItem: null, completed: 0, pendingCount: 0, total: 0, isInProgress: false },
    isProgressModalOpen: false,
    onDismissProgressModal: vi.fn(),
    onCancelQueue: vi.fn(),
    runQueuedBulkAction: runQueuedBulkActionMock,
  }),
}));

vi.mock('./bulk/bulkSetCohortFlow', async () => {
  const actual = (await vi.importActual('./bulk/bulkSetCohortFlow')) as typeof BulkSetCohortFlowModule;
  return {
    ...actual,
    bulkSetCohort: bulkSetCohortMock,
  };
});

vi.mock('./bulk/bulkSetYearGroupFlow', async () => {
  const actual = (await vi.importActual('./bulk/bulkSetYearGroupFlow')) as typeof BulkSetYearGroupFlowModule;
  return {
    ...actual,
    bulkSetYearGroup: bulkSetYearGroupMock,
  };
});

vi.mock('./bulk/bulkSetCourseLengthFlow', async () => {
  const actual = (await vi.importActual('./bulk/bulkSetCourseLengthFlow')) as typeof BulkSetCourseLengthFlowModule;
  return {
    ...actual,
    bulkSetCourseLength: bulkSetCourseLengthMock,
  };
});

vi.mock('./components/ClassesSummaryCard', () => ({
  ClassesSummaryCard() {
    return <div>Summary</div>;
  },
}));

vi.mock('./table/ClassesToolbar', () => ({
  ClassesToolbar(properties: Readonly<{
    onSetCohort?: () => void;
    onSetCourseLength?: () => void;
    onSetYearGroup?: () => void;
  }>) {
    return (
      <div>
        <button onClick={properties.onSetCohort} type="button">
          Set cohort
        </button>
        <button onClick={properties.onSetYearGroup} type="button">
          Set year group
        </button>
        <button onClick={properties.onSetCourseLength} type="button">
          Set course length
        </button>
      </div>
    );
  },
}));

vi.mock('./table/ClassesTable', () => ({
  ClassesTable() {
    return <div aria-label="Classes table" role="table" />;
  },
}));

vi.mock('./bulk/BulkCreateModal', () => ({
  BulkCreateModal() {
    return null;
  },
}));

vi.mock('./bulk/BulkDeleteModal', () => ({
  BulkDeleteModal() {
    return null;
  },
}));

/**
 * Renders a light-weight select modal stub for the bulk metadata failure tests.
 *
 * @param {Readonly<{
 *   open: boolean;
 *   title: string;
 *   options: ReadonlyArray<{ label: string; value: string }>;
 *   onConfirm: (value: string) => Promise<void>;
 * }>} properties Modal properties.
 * @returns {JSX.Element | null} Stub modal output.
 */
function BulkSetSelectModalStub(
  properties: Readonly<{
    open: boolean;
    title: string;
    options: ReadonlyArray<{ label: string; value: string }>;
    onConfirm: (value: string) => Promise<void>;
  }>
) {
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  if (!properties.open) {
    return null;
  }

  const lastOptionIndex = properties.options.length - 1;
  const selectedValue = properties.options.at(lastOptionIndex)?.value ?? '';

  return (
    <div role="dialog" aria-label={properties.title}>
      {submissionError ? <div>{submissionError}</div> : null}
      <button
        type="button"
        onClick={() => {
          void (async () => {
            setSubmissionError(null);
            try {
              await properties.onConfirm(selectedValue);
            } catch (error: unknown) {
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : 'Unable to update the selected classes.'
              );
            }
          })();
        }}
      >
        OK
      </button>
    </div>
  );
}

/**
 * Renders a light-weight course-length modal stub for the bulk metadata failure tests.
 *
 * @param {Readonly<{
 *   open: boolean;
 *   onConfirm: (value: number) => Promise<void>;
 * }>} properties Modal properties.
 * @returns {JSX.Element | null} Stub modal output.
 */
function BulkSetCourseLengthModalStub(
  properties: Readonly<{
    open: boolean;
    onConfirm: (value: number) => Promise<void>;
  }>
) {
  const [submissionError, setSubmissionError] = React.useState<string | null>(null);

  if (!properties.open) {
    return null;
  }

  return (
    <div role="dialog" aria-label="Set course length">
      {submissionError ? <div>{submissionError}</div> : null}
      <button
        type="button"
        onClick={() => {
          void (async () => {
            setSubmissionError(null);
            try {
              await properties.onConfirm(UPDATED_COURSE_LENGTH);
            } catch (error: unknown) {
              setSubmissionError(
                error instanceof Error
                  ? error.message
                  : 'Unable to update the selected classes.'
              );
            }
          })();
        }}
      >
        OK
      </button>
    </div>
  );
}

const bulkSetSelectModalMock = vi.hoisted(() => vi.fn(BulkSetSelectModalStub));
const bulkSetCourseLengthModalMock = vi.hoisted(() => vi.fn(BulkSetCourseLengthModalStub));

vi.mock('./bulk/BulkSetSelectModal', () => ({
  BulkSetSelectModal: bulkSetSelectModalMock,
}));

vi.mock('./bulk/BulkSetCourseLengthModal', () => ({
  BulkSetCourseLengthModal: bulkSetCourseLengthModalMock,
}));

const rows = [
  buildClassesManagementRow({
    classId: 'active-1',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
  }),
  buildClassesManagementRow({
    active: false,
    classId: 'inactive-1',
    className: 'Bravo',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    courseLength: 3,
    status: 'inactive',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
  }),
];
const selectedMetadataYearGroups = yearGroupOptions.filter(
  ({ key }) => key === 'year-7' || key === 'year-8',
);

let user: ReturnType<typeof userEvent.setup>;

/**
 * Renders the panel with a mocked classes-management state and query client.
 *
 * @param {ReactElement} ui Panel element.
 * @param {ReturnType<typeof vi.fn>} onSelectedRowKeysChange Selection callback spy.
 * @returns {{ invalidateQueriesSpy: MockInstance; onSelectedRowKeysChange: ReturnType<typeof vi.fn> }} Render spies.
 */
function renderPanel(ui: ReactElement, onSelectedRowKeysChange = vi.fn()) {
  classesManagementStateMock.mockReturnValue(
    buildClassesManagementState({
      cohorts: activeCohortOptions,
      onSelectedRowKeysChange,
      rows,
      selectedRowKeys: ['active-1', 'inactive-1'],
      yearGroups: selectedMetadataYearGroups,
    }),
  );

  const { queryClient } = renderWithFrontendProviders(ui);
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  return {
    invalidateQueriesSpy,
    onSelectedRowKeysChange,
  };
}

/**
 * Loads the panel module after mocks are installed.
 *
 * @returns {Promise<typeof import('./ClassesManagementPanel')>} Panel module.
 */
async function loadPanel() {
  return import('./ClassesManagementPanel');
}

/**
 * Opens and submits one of the select-based metadata modals.
 *
 * @param {'Set cohort' | 'Set year group'} buttonName Toolbar button and dialog name.
 * @returns {Promise<void>} Completion signal.
 */
async function submitSelectModal(buttonName: 'Set cohort' | 'Set year group') {
  await user.click(screen.getByRole('button', { name: buttonName }));
  const dialog = await screen.findByRole('dialog', { name: buttonName });
  await user.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Opens and submits the course-length metadata modal.
 *
 * @returns {Promise<void>} Completion signal.
 */
async function submitCourseLengthModal() {
  await user.click(screen.getByRole('button', { name: 'Set course length' }));
  const dialog = await screen.findByRole('dialog', { name: 'Set course length' });
  await user.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Asserts the all-failure metadata state: modal closes (shouldCloseModal: true),
 * panel alert appears with error copy, and failed rows are reselected.
 *
 * @param {ReturnType<typeof vi.fn>} onSelectedRowKeysChange Selection callback spy.
 * @param {MockInstance} invalidateQueriesSpy Query invalidation spy.
 * @param {string[]} expectedSelectedRowKeys Expected row keys to keep selected.
 * @returns {Promise<void>} Completion signal.
 */
async function expectAllFailureState(
  onSelectedRowKeysChange: ReturnType<typeof vi.fn>,
  invalidateQueriesSpy: MockInstance,
  expectedSelectedRowKeys: string[]
) {
  // Modal should have closed (shouldCloseModal: true)
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: /set/i })).not.toBeInTheDocument();
  });

  // Panel alert should show full-failure copy
  expect(
    await screen.findByText(
      'Unable to update any of the 2 selected classes. Please review the remaining selection and try again.'
    )
  ).toBeInTheDocument();

  await waitFor(() =>
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' })
    )
  );
  expect(onSelectedRowKeysChange).toHaveBeenCalledWith(expectedSelectedRowKeys);
  expect(onSelectedRowKeysChange).not.toHaveBeenCalledWith([]);
}

describe('ClassesManagementPanel bulk metadata failure handling', () => {
  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a panel-level alert and closes the modal after a full cohort failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCohortMock.mockImplementation(() => Promise.resolve([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]));
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set cohort');

    await waitFor(() => {
      expect(bulkSetCohortMock).toHaveBeenCalledWith(rows, 'cohort-2025', expect.any(Function));
    });
    await expectAllFailureState(
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });

  it('shows a panel-level alert and closes the modal after a full year-group failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetYearGroupMock.mockImplementation(() => Promise.resolve([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]));
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set year group');

    await waitFor(() => {
      expect(bulkSetYearGroupMock).toHaveBeenCalledWith(rows, 'year-8', expect.any(Function));
    });
    await expectAllFailureState(
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });

  it('closes the metadata modal and promotes warning feedback to panel scope on partial failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCohortMock.mockImplementation(() => Promise.resolve([
      { status: 'fulfilled', row: rows[0], data: { ok: true } },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]));
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set cohort');

    await waitFor(() => {
      expect(bulkSetCohortMock).toHaveBeenCalledWith(rows, 'cohort-2025', expect.any(Function));
    });
    await waitFor(() =>
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: queryKeys.classPartials(), refetchType: 'none' })
      )
    );
    await expect(screen.queryByRole('dialog', { name: 'Set cohort' })).toBeNull();
    expect(screen.getByText('Some selected classes were not updated.')).toBeInTheDocument();
    expect(screen.getByText(/selected classes could not be updated/i)).toBeInTheDocument();
    expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['inactive-1']);
  });

  it('shows a panel-level alert and closes the modal after a full course-length failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCourseLengthMock.mockImplementation(() => Promise.resolve([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]));
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitCourseLengthModal();

    await waitFor(() => {
      expect(bulkSetCourseLengthMock).toHaveBeenCalledWith(rows, UPDATED_COURSE_LENGTH, expect.any(Function));
    });
    await expectAllFailureState(
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });
});
