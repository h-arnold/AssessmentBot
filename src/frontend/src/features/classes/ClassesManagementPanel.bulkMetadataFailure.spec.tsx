import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from "react";
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';
import type * as BulkSetYearGroupFlowModule from './bulkSetYearGroupFlow';
import type * as BulkSetCourseLengthFlowModule from './bulkSetCourseLengthFlow';
import type { ClassTableRow } from './bulkCreateFlow';
import type { ClassesManagementRow } from './classesManagementViewModel';

const classesManagementStateMock = vi.fn();
const bulkSetCohortMock = vi.hoisted(() => vi.fn());
const bulkSetYearGroupMock = vi.hoisted(() => vi.fn());
const bulkSetCourseLengthMock = vi.hoisted(() => vi.fn());
const UPDATED_COURSE_LENGTH = 6;

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./bulkSetCohortFlow', async () => {
  const actual = await vi.importActual('./bulkSetCohortFlow') as typeof BulkSetCohortFlowModule;
  return {
    ...actual,
    bulkSetCohort: bulkSetCohortMock,
  };
});

vi.mock('./bulkSetYearGroupFlow', async () => {
  const actual = await vi.importActual('./bulkSetYearGroupFlow') as typeof BulkSetYearGroupFlowModule;
  return {
    ...actual,
    bulkSetYearGroup: bulkSetYearGroupMock,
  };
});

vi.mock('./bulkSetCourseLengthFlow', async () => {
  const actual = await vi.importActual('./bulkSetCourseLengthFlow') as typeof BulkSetCourseLengthFlowModule;
  return {
    ...actual,
    bulkSetCourseLength: bulkSetCourseLengthMock,
  };
});

const rows: ClassesManagementRow[] = [
  {
    classId: 'active-1',
    className: 'Alpha',
    status: 'active',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    courseLength: 2,
    active: true,
  },
  {
    classId: 'inactive-1',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-2024',
    cohortLabel: 'Cohort 2024',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
    courseLength: 3,
    active: false,
  },
];

const cohorts = [
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: true,
    startYear: 2024,
    startMonth: 9,
  },
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
] as const;

const yearGroups = [
  {
    key: 'year-7',
    name: 'Year 7',
  },
  {
    key: 'year-8',
    name: 'Year 8',
  },
] as const;

/**
 * Maps a classes-management row to the bulk-flow row shape.
 *
 * @param {ClassesManagementRow} row Source row.
 * @returns {ClassTableRow} Adapted row.
 */
function toClassTableRow(row: ClassesManagementRow): ClassTableRow {
  return {
    rowKey: row.classId,
    classId: row.classId,
    className: row.className,
    status: 'linked',
    cohortKey: row.cohortKey ?? null,
    yearGroupKey: row.yearGroupKey ?? null,
    courseLength: row.courseLength ?? 1,
    active: row.active,
  };
}

/**
 * Renders the panel with a mocked classes-management state and query client.
 *
 * @param {ReactElement} ui Panel element.
 * @param {ReturnType<typeof vi.fn>} onSelectedRowKeysChange Selection callback spy.
 * @returns {{ invalidateQueriesSpy: MockInstance; onSelectedRowKeysChange: ReturnType<typeof vi.fn> }} Render spies.
 */
function renderPanel(ui: ReactElement, onSelectedRowKeysChange = vi.fn()) {
  classesManagementStateMock.mockReturnValue({
    blockingErrorMessage: null,
    classesManagementViewState: 'ready',
    classesCount: rows.length,
    cohorts,
    errorMessage: null,
    nonBlockingWarningMessage: null,
    refreshRequiredMessage: null,
    rows,
    selectedRowKeys: ['active-1', 'inactive-1'],
    yearGroups,
    onSelectedRowKeysChange,
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  return {
    invalidateQueriesSpy,
    onSelectedRowKeysChange,
  };
}

/**
 * Loads the panel module after mocks are installed.
 *
 * @returns {Promise<typeof import("./ClassesManagementPanel")>} Panel module.
 */
async function loadPanel() {
  return import('./ClassesManagementPanel');
}

/**
 * Opens and submits one of the select-based metadata modals.
 *
 * @param {'Set cohort' | 'Set year group'} buttonName Toolbar button and dialog name.
 * @param {'Cohort' | 'Year group'} fieldLabel Form field label.
 * @param {string} optionName Option label to submit.
 * @returns {Promise<void>} Completion signal.
 */
async function submitSelectModal(
  buttonName: 'Set cohort' | 'Set year group',
  fieldLabel: 'Cohort' | 'Year group',
  optionName: string,
) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  const dialog = await screen.findByRole('dialog', { name: buttonName });
  fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: fieldLabel }));
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Opens and submits the course-length metadata modal.
 *
 * @param {string} courseLength Course length input value.
 * @returns {Promise<void>} Completion signal.
 */
async function submitCourseLengthModal(courseLength: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Set course length' }));
  const dialog = await screen.findByRole('dialog', { name: 'Set course length' });
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Course length' }), {
    target: { value: courseLength },
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Asserts the shared failure-state behaviour for a bulk metadata modal.
 *
 * @param {'Set cohort' | 'Set year group' | 'Set course length'} dialogName Active dialog name.
 * @param {ReturnType<typeof vi.fn>} onSelectedRowKeysChange Selection callback spy.
 * @param {MockInstance} invalidateQueriesSpy Query invalidation spy.
 * @returns {Promise<void>} Completion signal.
 */
async function expectFailureState(
  dialogName: 'Set cohort' | 'Set year group' | 'Set course length',
  onSelectedRowKeysChange: ReturnType<typeof vi.fn>,
  invalidateQueriesSpy: MockInstance,
) {
  expect(await screen.findByRole('dialog', { name: dialogName })).toBeInTheDocument();
  expect(
    await screen.findByText(/selected classes could not be updated|unable to update the selected class/i),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: queryKeys.classPartials() }),
  );
  expect(onSelectedRowKeysChange).toHaveBeenCalledWith(['inactive-1']);
  expect(onSelectedRowKeysChange).not.toHaveBeenCalledWith([]);
}

describe('ClassesManagementPanel bulk metadata failure handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the cohort modal open with inline feedback and reselects only failed rows after a partial failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCohortMock.mockResolvedValue([
      { status: 'fulfilled', row: toClassTableRow(rows[0]), data: { ok: true } },
      { status: 'rejected', row: toClassTableRow(rows[1]), error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set cohort', 'Cohort', 'Cohort 2025');

    await waitFor(() =>
      expect(bulkSetCohortMock).toHaveBeenCalledWith(
        [toClassTableRow(rows[0]), toClassTableRow(rows[1])],
        'cohort-2025',
      ),
    );
    await expectFailureState('Set cohort', onSelectedRowKeysChange, invalidateQueriesSpy);
  });

  it('keeps the year-group modal open with inline feedback and reselects only failed rows after a partial failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetYearGroupMock.mockResolvedValue([
      { status: 'fulfilled', row: toClassTableRow(rows[0]), data: { ok: true } },
      { status: 'rejected', row: toClassTableRow(rows[1]), error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set year group', 'Year group', 'Year 8');

    await waitFor(() =>
      expect(bulkSetYearGroupMock).toHaveBeenCalledWith(
        [toClassTableRow(rows[0]), toClassTableRow(rows[1])],
        'year-8',
      ),
    );
    await expectFailureState('Set year group', onSelectedRowKeysChange, invalidateQueriesSpy);
  });

  it('keeps the course-length modal open with inline feedback and reselects only failed rows after a partial failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCourseLengthMock.mockResolvedValue([
      { status: 'fulfilled', row: toClassTableRow(rows[0]), data: { ok: true } },
      { status: 'rejected', row: toClassTableRow(rows[1]), error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitCourseLengthModal(String(UPDATED_COURSE_LENGTH));

    await waitFor(() =>
      expect(bulkSetCourseLengthMock).toHaveBeenCalledWith(
        [toClassTableRow(rows[0]), toClassTableRow(rows[1])],
        UPDATED_COURSE_LENGTH,
      ),
    );
    await expectFailureState('Set course length', onSelectedRowKeysChange, invalidateQueriesSpy);
  });
});
