/**
 * Cohort management modal — unit tests.
 *
 * Covers: list rendering, empty state, create/edit form launch, active-state toggle,
 * query invalidation after successful mutations, and modal close wiring.
 *
 * RED PHASE: ManageCohortsModal does not yet exist; these tests are expected to fail
 * with module-not-found errors until the component is implemented.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../services/referenceData.zod';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
// RED: ManageCohortsModal does not exist yet — import fails in the red phase.
import { ManageCohortsModal } from './ManageCohortsModal';

const createCohortMock = vi.hoisted(() => vi.fn());
const updateCohortMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: createCohortMock,
  updateCohort: updateCohortMock,
  deleteCohort: vi.fn(),
  getYearGroups: vi.fn(),
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: vi.fn(),
}));

const onCloseMock = vi.fn();

const seedCohorts: Cohort[] = [
  {
    key: 'cohort-2025',
    name: 'Cohort 2025',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  {
    key: 'cohort-2024',
    name: 'Cohort 2024',
    active: false,
    startYear: 2024,
    startMonth: 9,
  },
];

/**
 * Renders ManageCohortsModal with pre-seeded cohort data and optional overrides.
 *
 * @param {object} [options] Render options.
 * @param {boolean} [options.open] Whether the modal is open.
 * @param {Cohort[]} [options.cohorts] Cohorts to seed in the query cache.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageCohortsModal(options: { open?: boolean; cohorts?: Cohort[] } = {}) {
  const { open = true, cohorts = seedCohorts } = options;
  const queryClient = createAppQueryClient();

  queryClient.setQueryData(queryKeys.cohorts(), cohorts);

  return renderWithFrontendProviders(<ManageCohortsModal open={open} onClose={onCloseMock} />, {
    queryClient,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ManageCohortsModal', () => {
  describe('list rendering', () => {
    it('renders a table listing cohorts with name, start year, start month, and active state columns', async () => {
      renderManageCohortsModal();

      const table = await screen.findByRole('table', { name: /cohorts/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Cohort 2025')).toBeInTheDocument();
      expect(within(table).getByText('Cohort 2024')).toBeInTheDocument();
    });

    it('shows start year and start month for each cohort row', async () => {
      renderManageCohortsModal();

      const table = await screen.findByRole('table', { name: /cohorts/i });
      // Scope per-row to avoid multi-match: both seed cohorts share startMonth 9.
      const [, firstRow, secondRow] = within(table).getAllByRole('row');
      expect(within(firstRow).getByText('2025')).toBeInTheDocument();
      expect(within(firstRow).getByText('9')).toBeInTheDocument();
      expect(within(secondRow).getByText('2024')).toBeInTheDocument();
      expect(within(secondRow).getByText('9')).toBeInTheDocument();
    });

    it('shows active and inactive state for respective cohort rows', async () => {
      renderManageCohortsModal();

      const table = await screen.findByRole('table', { name: /cohorts/i });
      const activeRow = within(table).getByRole('row', { name: /cohort 2025/i });
      const inactiveRow = within(table).getByRole('row', { name: /cohort 2024/i });

      // The active-state toggle should reflect the cohort's current active value.
      expect(within(activeRow).getByRole('switch')).toBeChecked();
      expect(within(inactiveRow).getByRole('switch')).not.toBeChecked();
    });

    it('renders Edit and Delete action buttons for each cohort row', async () => {
      renderManageCohortsModal();

      const table = await screen.findByRole('table', { name: /cohorts/i });
      const rows = within(table).getAllByRole('row').slice(1); // skip header row

      for (const row of rows) {
        expect(within(row).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      }
    });
  });

  describe('empty state', () => {
    it('shows an empty state and a primary Create cohort button when no cohorts exist', async () => {
      renderManageCohortsModal({ cohorts: [] });

      await screen.findByText(/no cohorts/i);
      expect(screen.getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('renders a Create cohort button when cohorts are listed', async () => {
      renderManageCohortsModal();

      await screen.findByRole('table', { name: /cohorts/i });
      expect(screen.getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
    });

    it('opens a blank cohort form modal when the Create cohort button is clicked', async () => {
      renderManageCohortsModal();

      await screen.findByRole('table', { name: /cohorts/i });
      fireEvent.click(screen.getByRole('button', { name: /create cohort/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create cohort/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled cohort form modal when an Edit button is clicked', async () => {
      renderManageCohortsModal();

      const table = await screen.findByRole('table', { name: /cohorts/i });
      const firstDataRow = within(table).getAllByRole('row')[1];
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit cohort/i });
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('calls updateCohort and invalidates the cohorts query after a successful edit', async () => {
      const updatedCohort: Cohort = { ...seedCohorts[0], name: 'Cohort 2025 Updated' };
      updateCohortMock.mockResolvedValue(updatedCohort);

      const { queryClient } = renderManageCohortsModal();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const table = await screen.findByRole('table', { name: /cohorts/i });
      const firstDataRow = within(table).getAllByRole('row')[1];
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit cohort/i });
      const nameInput = within(formDialog).getByRole('textbox', { name: /name/i });
      fireEvent.change(nameInput, { target: { value: 'Cohort 2025 Updated' } });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|update/i }));

      await waitFor(() => {
        expect(updateCohortMock).toHaveBeenCalledWith({
          key: seedCohorts[0].key,
          record: expect.objectContaining({ name: 'Cohort 2025 Updated' }),
        });
      });
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: queryKeys.cohorts() }),
        );
      });
    });
  });

  describe('create flow', () => {
    it('calls createCohort and invalidates the cohorts query after a successful create', async () => {
      const newCohort: Cohort = {
        key: 'cohort-2026',
        name: 'Cohort 2026',
        active: true,
        startYear: 2026,
        startMonth: 9,
      };
      createCohortMock.mockResolvedValue(newCohort);

      const { queryClient } = renderManageCohortsModal();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      await screen.findByRole('table', { name: /cohorts/i });
      fireEvent.click(screen.getByRole('button', { name: /create cohort/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create cohort/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: 'Cohort 2026' },
      });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|create/i }));

      await waitFor(() => {
        expect(createCohortMock).toHaveBeenCalledWith({
          record: expect.objectContaining({ name: 'Cohort 2026' }),
        });
      });
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: queryKeys.cohorts() }),
        );
      });
    });
  });

  describe('active-state toggle', () => {
    it('calls updateCohort and invalidates the cohorts query when the active Switch is toggled', async () => {
      const toggled: Cohort = { ...seedCohorts[0], active: false };
      updateCohortMock.mockResolvedValue(toggled);

      const { queryClient } = renderManageCohortsModal();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const table = await screen.findByRole('table', { name: /cohorts/i });
      const activeRow = within(table).getByRole('row', { name: /cohort 2025/i });
      fireEvent.click(within(activeRow).getByRole('switch'));

      await waitFor(() => {
        expect(updateCohortMock).toHaveBeenCalledWith({
          key: seedCohorts[0].key,
          record: expect.objectContaining({ active: false }),
        });
      });
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: queryKeys.cohorts() }),
        );
      });
    });
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageCohortsModal();

      await screen.findByRole('table', { name: /cohorts/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageCohortsModal({ open: false });

      expect(screen.queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
    });
  });
});
