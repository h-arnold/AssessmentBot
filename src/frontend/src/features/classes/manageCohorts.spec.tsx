/**
 * Cohort management modal — unit tests.
 *
 * Covers: list rendering, empty state, create/edit form launch, active-state toggle,
 * required refresh after successful mutations, degraded-data fail-closed handling, and modal
 * close wiring.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../services/referenceData.zod';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ManageCohortsModal } from './ManageCohortsModal';

const createCohortMock = vi.hoisted(() => vi.fn());
const updateCohortMock = vi.hoisted(() => vi.fn());
const getCohortsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  createCohort: createCohortMock,
  updateCohort: updateCohortMock,
  deleteCohort: vi.fn(),
  getYearGroups: vi.fn(),
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: vi.fn(),
}));

const onCloseMock = vi.fn();
const cohortsLoadFailureCopy = 'Unable to load cohorts right now.';

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
 * @param {boolean} [options.seedQueryData] Whether to seed the query cache before render.
 * @param {Cohort[]} [options.cohorts] Cohorts to seed in the query cache.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageCohortsModal(
  options: { open?: boolean; cohorts?: Cohort[]; seedQueryData?: boolean } = {},
) {
  const { open = true, cohorts = seedCohorts, seedQueryData = true } = options;
  const queryClient = createAppQueryClient();

  if (seedQueryData) {
    queryClient.setQueryData(queryKeys.cohorts(), cohorts);
  }
  getCohortsMock.mockResolvedValue(cohorts);

  return renderWithFrontendProviders(<ManageCohortsModal open={open} onClose={onCloseMock} />, {
    queryClient,
  });
}


/**
 * Returns the owned Manage Cohorts modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Cohorts dialog.
 */
function getManageCohortsModalDialog() {
  return screen.getByRole('dialog', { name: 'Manage Cohorts' });
}

/**
 * Finds the owned Manage Cohorts modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Cohorts dialog.
 */
async function findManageCohortsModalDialog() {
  return screen.findByRole('dialog', { name: 'Manage Cohorts' });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCohortsMock.mockResolvedValue(seedCohorts);
});

describe('ManageCohortsModal', () => {
  describe('initial loading state', () => {
    it('renders a skeleton status region instead of the ready cohorts table while cohort data is still loading', () => {
      getCohortsMock.mockImplementation(() => new Promise(() => {}));

      renderManageCohortsModal({ seedQueryData: false });
      const dialog = getManageCohortsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading cohorts' })).toBeInTheDocument();
      expect(dialog.querySelector('.ant-skeleton')).not.toBeNull();
      expect(within(dialog).queryByRole('button', { name: /create cohort/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Cohort 2025')).not.toBeInTheDocument();
    });

    it('suppresses the ready modal body when the cohorts query fails before any usable data loads', async () => {
      getCohortsMock.mockRejectedValueOnce(new Error('Cohorts failed to load.'));

      const queryClient = createAppQueryClient();
      renderWithFrontendProviders(<ManageCohortsModal open={true} onClose={onCloseMock} />, {
        queryClient,
      });
      const dialog = await findManageCohortsModalDialog();

      await waitFor(() => {
        expect(within(dialog).queryByRole('button', { name: /create cohort/i })).not.toBeInTheDocument();
      });
      expect(within(dialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
      expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
    });

    it('keeps the trusted cohorts table visible when a later refetch fails', async () => {
      const { queryClient } = renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      expect(within(table).getByText('Cohort 2025')).toBeInTheDocument();

      getCohortsMock.mockRejectedValueOnce(new Error('Background cohorts refresh failed.'));

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      });

      await waitFor(() => {
        expect(getCohortsMock).toHaveBeenCalledTimes(1);
      });
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /cohorts/i })).toBeInTheDocument();
      expect(within(dialog).getByText('Cohort 2025')).toBeInTheDocument();
      expect(within(dialog).getByText('Cohort 2024')).toBeInTheDocument();
    });

    it('keeps trusted cohort data visible while publishing modal busy state during background refresh', async () => {
      const { queryClient } = renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });

      let releaseRefresh: (() => void) | undefined;
      getCohortsMock.mockImplementationOnce(() => new Promise<Cohort[]>((resolve) => {
        releaseRefresh = () => resolve(seedCohorts);
      }));

      try {
        await act(async () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
        });

        await waitFor(() => {
          expect(getCohortsMock).toHaveBeenCalledTimes(1);
        });

        expect(dialog).toHaveAttribute('aria-busy', 'true');
        expect(within(dialog).getByText('Refreshing cohorts...')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
        expect(within(dialog).getByRole('table', { name: /cohorts/i })).toBeInTheDocument();
        expect(within(dialog).getByText('Cohort 2025')).toBeInTheDocument();
      } finally {
        releaseRefresh?.();
      }
    });
  });

  describe('list rendering', () => {
    it('renders a table listing cohorts with name, start year, start month, and active state columns', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Cohort 2025')).toBeInTheDocument();
      expect(within(table).getByText('Cohort 2024')).toBeInTheDocument();
    });

    it('shows start year and start month for each cohort row', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      // Scope per-row to avoid multi-match: both seed cohorts share startMonth 9.
      const [, firstRow, secondRow] = within(table).getAllByRole('row');
      expect(within(firstRow).getByText('2025')).toBeInTheDocument();
      expect(within(firstRow).getByText('9')).toBeInTheDocument();
      expect(within(secondRow).getByText('2024')).toBeInTheDocument();
      expect(within(secondRow).getByText('9')).toBeInTheDocument();
    });

    it('shows active and inactive state for respective cohort rows', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      const activeRow = within(table).getByRole('row', { name: /cohort 2025/i });
      const inactiveRow = within(table).getByRole('row', { name: /cohort 2024/i });

      // The active-state toggle should reflect the cohort's current active value.
      expect(within(activeRow).getByRole('switch')).toBeChecked();
      expect(within(inactiveRow).getByRole('switch')).not.toBeChecked();
    });

    it('renders Edit and Delete action buttons for each cohort row', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
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

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByText(/no cohorts/i);
      expect(within(dialog).getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('renders a Create cohort button when cohorts are listed', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      expect(within(dialog).getByRole('button', { name: /create cohort/i })).toBeInTheDocument();
    });

    it('opens a blank cohort form modal when the Create cohort button is clicked', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      getCohortsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create cohort/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled cohort form modal when an Edit button is clicked', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      const firstDataRow = within(table).getAllByRole('row')[1];
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit cohort/i });
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('calls updateCohort and refetches the active cohorts query after a successful edit', async () => {
      const updatedCohort: Cohort = { ...seedCohorts[0], name: 'Cohort 2025 Updated' };
      updateCohortMock.mockResolvedValue(updatedCohort);

      const { queryClient } = renderManageCohortsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
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
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.cohorts(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('create flow', () => {
    it('calls createCohort and refetches the active cohorts query after a successful create', async () => {
      const newCohort: Cohort = {
        key: 'cohort-2026',
        name: 'Cohort 2026',
        active: true,
        startYear: 2026,
        startMonth: 9,
      };
      createCohortMock.mockResolvedValue(newCohort);

      const { queryClient } = renderManageCohortsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      getCohortsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));

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
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.cohorts(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('required refresh failures', () => {
    it('fails closed when a successful create cannot refresh the now-invalid cohorts data', async () => {
      const newCohort: Cohort = {
        key: 'cohort-2026',
        name: 'Cohort 2026',
        active: true,
        startYear: 2026,
        startMonth: 9,
      };
      createCohortMock.mockResolvedValue(newCohort);

      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      getCohortsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));

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
        expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /create cohort/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /create cohort/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
    });

    it('keeps the fail-closed cohorts state blocked after remount while the cached data is still untrustworthy', async () => {
      const newCohort: Cohort = {
        key: 'cohort-2026',
        name: 'Cohort 2026',
        active: true,
        startYear: 2026,
        startMonth: 9,
      };
      createCohortMock.mockResolvedValue(newCohort);

      const { queryClient, unmount } = renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      getCohortsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create cohort/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: 'Cohort 2026' },
      });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|create/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      });

      unmount();
      renderWithFrontendProviders(<ManageCohortsModal open={true} onClose={onCloseMock} />, {
        queryClient,
      });

      const remountedDialog = await findManageCohortsModalDialog();
      expect(within(remountedDialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      expect(within(remountedDialog).queryByRole('button', { name: /create cohort/i })).not.toBeInTheDocument();
      expect(within(remountedDialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
    });
  });

  describe('active-state toggle', () => {
    it('calls updateCohort and refetches the active cohorts query when the active Switch is toggled', async () => {
      const toggled: Cohort = { ...seedCohorts[0], active: false };
      updateCohortMock.mockResolvedValue(toggled);

      const { queryClient } = renderManageCohortsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });
      const activeRow = within(table).getByRole('row', { name: /cohort 2025/i });
      fireEvent.click(within(activeRow).getByRole('switch'));

      await waitFor(() => {
        expect(updateCohortMock).toHaveBeenCalledWith({
          key: seedCohorts[0].key,
          record: expect.objectContaining({ active: false }),
        });
      });
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.cohorts(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageCohortsModal({ open: false });

      expect(screen.queryByRole('dialog', { name: 'Manage Cohorts' })).not.toBeInTheDocument();
    });
  });
});
