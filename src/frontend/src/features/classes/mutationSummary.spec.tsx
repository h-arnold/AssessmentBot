import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTransportError } from '../../errors/apiTransportError';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import type * as BulkSetCohortFlowModule from './bulkSetCohortFlow';
import {
  buildClassesManagementRow,
  buildClassesManagementState,
} from '../../test/classes/classesTestHelpers';

const classesManagementStateMock = vi.fn();
const bulkSetCohortMock = vi.fn();
const LAST_OPTION_OFFSET = 1;
const bulkSetSelectModalMock = vi.hoisted(() =>
  vi.fn(
    (properties: Readonly<{
      open: boolean;
      options: ReadonlyArray<{ label: string; value: string }>;
      title: string;
      onConfirm: (value: string) => Promise<void>;
    }>) => {
      if (properties.open === false) {
        return null;
      }
      const selectedValue = properties.options.at(-LAST_OPTION_OFFSET)?.value ?? '';

      return (
        <div aria-label={properties.title} role="dialog">
          <button
            onClick={() => {
              void properties.onConfirm(selectedValue);
            }}
            type="button"
          >
            OK
          </button>
        </div>
      );
    },
  ),
);

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

vi.mock('./ClassesSummaryCard', () => ({
  ClassesSummaryCard() {
    return <div>Summary</div>;
  },
}));

vi.mock('./ClassesToolbar', () => ({
  ClassesToolbar(properties: Readonly<{ onSetCohort?: () => void }>) {
    return (
      <button onClick={properties.onSetCohort} type="button">
        Set cohort
      </button>
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

vi.mock('./BulkSetCourseLengthModal', () => ({
  BulkSetCourseLengthModal() {
    return null;
  },
}));

vi.mock('./BulkSetSelectModal', () => ({
  BulkSetSelectModal: bulkSetSelectModalMock,
}));

const metadataRows = [
  buildClassesManagementRow({
    classId: 'class-1',
    className: 'Alpha',
    cohortKey: 'cohort-a',
    cohortLabel: 'Cohort A',
    yearGroupKey: 'year-7',
    yearGroupLabel: 'Year 7',
  }),
  buildClassesManagementRow({
    classId: 'class-2',
    className: 'Bravo',
    status: 'inactive',
    cohortKey: 'cohort-b',
    cohortLabel: 'Cohort B',
    yearGroupKey: 'year-8',
    yearGroupLabel: 'Year 8',
    courseLength: 3,
    active: false,
  }),
];

/**
 * Installs the default classes-management hook state for mutation-summary tests.
 *
 * @returns {void}
 */
function mockClassesManagementState() {
  classesManagementStateMock.mockReturnValue(
    buildClassesManagementState({
      cohorts: [
        { key: 'cohort-a', name: 'Cohort A', active: true, startYear: 2024, startMonth: 9 },
        { key: 'cohort-c', name: 'Cohort C', active: true, startYear: 2025, startMonth: 9 },
      ],
      rows: metadataRows,
      selectedRowKeys: ['class-1', 'class-2'],
      yearGroups: [],
    }),
  );
}

/**
 * Loads and renders the panel with shared frontend providers.
 *
 * @returns {Promise<ReturnType<typeof renderWithFrontendProviders>>} Render result plus query client.
 */
async function renderPanel() {
  const { ClassesManagementPanel } = await import('./ClassesManagementPanel');
  return renderWithFrontendProviders(<ClassesManagementPanel />);
}

beforeEach(() => {
  classesManagementStateMock.mockReset();
  bulkSetCohortMock.mockReset();
  bulkSetSelectModalMock.mockClear();
});

describe('mutationSummary', () => {
  it('hands partial metadata updates off to the persistent summary alert without refresh guidance', async () => {
    mockClassesManagementState();
    bulkSetCohortMock.mockResolvedValue([
      { status: 'fulfilled', row: metadataRows[0], data: { ok: true } },
      { status: 'rejected', row: metadataRows[1], error: new Error('Cohort update failed.') },
    ]);

    await renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Set cohort' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(bulkSetCohortMock).toHaveBeenCalledWith(metadataRows, 'cohort-c');
    });
    await screen.findByText('Some selected classes were not updated.');
    await screen.findByText(
      '1 of 2 selected classes could not be updated. Successful rows were refreshed. Please review the remaining selection and try again.',
    );
    expect(screen.queryByText('Update succeeded but refresh is required.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('The mutation succeeded, but refresh is required to see the latest classes.'),
    ).not.toBeInTheDocument();
  });

  it('uses refresh-failure guidance when a partial metadata update cannot be refreshed', async () => {
    mockClassesManagementState();
    bulkSetCohortMock.mockResolvedValue([
      { status: 'fulfilled', row: metadataRows[0], data: { ok: true } },
      { status: 'rejected', row: metadataRows[1], error: new Error('Cohort update failed.') },
    ]);

    const { queryClient } = await renderPanel();
    vi.spyOn(queryClient, 'refetchQueries').mockRejectedValueOnce(
      new ApiTransportError({
        requestId: 'request-refresh',
        error: {
          code: 'RATE_LIMITED',
          message: 'Transport refresh text.',
          retriable: true,
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set cohort' }));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));

    await waitFor(() => {
      expect(bulkSetCohortMock).toHaveBeenCalledWith(metadataRows, 'cohort-c');
    });
    await screen.findByText('Some selected classes were not updated.');
    await screen.findByText(
      '1 of 2 selected classes could not be updated. The update completed, but the classes could not be refreshed right now. Please reload the page and review the remaining selection.',
    );
    await screen.findByText('The classes are busy updating right now. Please try again shortly.');
    expect(screen.queryByRole('table', { name: 'Classes table' })).not.toBeInTheDocument();
    expect(screen.queryByText('Transport refresh text.')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Successful rows were refreshed. Please review the remaining selection and try again.'),
    ).not.toBeInTheDocument();
  });
});
