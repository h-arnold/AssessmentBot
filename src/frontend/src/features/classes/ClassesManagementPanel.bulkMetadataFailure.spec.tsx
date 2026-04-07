import * as React from 'react';
import type { ReactElement } from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';
import type * as BulkSetYearGroupFlowModule from './bulkSetYearGroupFlow';
import type * as BulkSetCourseLengthFlowModule from './bulkSetCourseLengthFlow';
import {
  activeCohortOptions,
  buildClassesManagementRow,
  buildClassesManagementState,
  yearGroupOptions,
} from './classesTestHelpers';

const classesManagementStateMock = vi.fn();
const bulkSetCohortMock = vi.hoisted(() => vi.fn());
const bulkSetYearGroupMock = vi.hoisted(() => vi.fn());
const bulkSetCourseLengthMock = vi.hoisted(() => vi.fn());
const UPDATED_COURSE_LENGTH = 6;

vi.mock('./useClassesManagement', () => ({
  useClassesManagement: classesManagementStateMock,
}));

vi.mock('./bulkSetCohortFlow', async () => {
  const actual = (await vi.importActual('./bulkSetCohortFlow')) as typeof BulkSetCohortFlowModule;
  return {
    ...actual,
    bulkSetCohort: bulkSetCohortMock,
  };
});

vi.mock('./bulkSetYearGroupFlow', async () => {
  const actual = (await vi.importActual('./bulkSetYearGroupFlow')) as typeof BulkSetYearGroupFlowModule;
  return {
    ...actual,
    bulkSetYearGroup: bulkSetYearGroupMock,
  };
});

vi.mock('./bulkSetCourseLengthFlow', async () => {
  const actual = (await vi.importActual('./bulkSetCourseLengthFlow')) as typeof BulkSetCourseLengthFlowModule;
  return {
    ...actual,
    bulkSetCourseLength: bulkSetCourseLengthMock,
  };
});

vi.mock('./ClassesSummaryCard', () => ({
  ClassesSummaryCard() {
    return <div>Summary</div>;
  },
}));

vi.mock('./ClassesToolbar', () => ({
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

vi.mock('./ClassesTable', () => ({
  ClassesTable() {
    return <div aria-label="Classes table" role="table" />;
  },
}));

vi.mock('./BulkCreateModal', () => ({
  BulkCreateModal() {
    return null;
  },
}));

vi.mock('./BulkDeleteModal', () => ({
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

vi.mock('./BulkSetSelectModal', () => ({
  BulkSetSelectModal: bulkSetSelectModalMock,
}));

vi.mock('./BulkSetCourseLengthModal', () => ({
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
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  const dialog = await screen.findByRole('dialog', { name: buttonName });
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Opens and submits the course-length metadata modal.
 *
 * @returns {Promise<void>} Completion signal.
 */
async function submitCourseLengthModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Set course length' }));
  const dialog = await screen.findByRole('dialog', { name: 'Set course length' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
}

/**
 * Asserts the shared failure-state behaviour for a bulk metadata modal.
 *
 * @param {'Set cohort' | 'Set year group' | 'Set course length'} dialogName Active dialog name.
 * @param {ReturnType<typeof vi.fn>} onSelectedRowKeysChange Selection callback spy.
 * @param {MockInstance} invalidateQueriesSpy Query invalidation spy.
 * @param {string[]} expectedSelectedRowKeys Expected row keys to keep selected.
 * @returns {Promise<void>} Completion signal.
 */
async function expectFailureState(
  dialogName: 'Set cohort' | 'Set year group' | 'Set course length',
  onSelectedRowKeysChange: ReturnType<typeof vi.fn>,
  invalidateQueriesSpy: MockInstance,
  expectedSelectedRowKeys: string[]
) {
  expect(await screen.findByRole('dialog', { name: dialogName })).toBeInTheDocument();
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
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the cohort modal open with inline feedback and reselects all failed rows after a full failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCohortMock.mockResolvedValue([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set cohort');

    await waitFor(() => {
      expect(bulkSetCohortMock).toHaveBeenCalledWith(rows, 'cohort-2025');
    });
    await expectFailureState(
      'Set cohort',
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });

  it('keeps the year-group modal open with inline feedback and reselects all failed rows after a full failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetYearGroupMock.mockResolvedValue([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitSelectModal('Set year group');

    await waitFor(() => {
      expect(bulkSetYearGroupMock).toHaveBeenCalledWith(rows, 'year-8');
    });
    await expectFailureState(
      'Set year group',
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });

  it('keeps the course-length modal open with inline feedback and reselects all failed rows after a full failure', async () => {
    const { ClassesManagementPanel } = await loadPanel();
    bulkSetCourseLengthMock.mockResolvedValue([
      { status: 'rejected', row: rows[0], error: new Error('Update failed.') },
      { status: 'rejected', row: rows[1], error: new Error('Update failed.') },
    ]);
    const { onSelectedRowKeysChange, invalidateQueriesSpy } = renderPanel(<ClassesManagementPanel />);

    await submitCourseLengthModal();

    await waitFor(() => {
      expect(bulkSetCourseLengthMock).toHaveBeenCalledWith(rows, UPDATED_COURSE_LENGTH);
    });
    await expectFailureState(
      'Set course length',
      onSelectedRowKeysChange,
      invalidateQueriesSpy,
      ['active-1', 'inactive-1']
    );
  });
});
