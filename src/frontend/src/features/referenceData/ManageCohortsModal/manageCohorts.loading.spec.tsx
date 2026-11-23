/**
 * Cohort management modal — loading, list rendering and create-button tests.
 *
 * Covers: skeleton readiness, blocking load failure, trusted data during
 * background refresh, cohort table columns and values, empty state, and the
 * create action.
 */

import '@/test/referenceData/manageCohorts.mockSetup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '@/services/referenceData/referenceData.zod';
import { queryKeys } from '@/query/queryKeys';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import {
  cohortsLoadFailureCopy,
  findManageCohortsModalDialog,
  getCohortsMock,
  onCloseMock,
  renderManageCohortsModal,
  seedCohorts,
} from '@/test/referenceData/manageCohortsTestHelpers';
import { ManageCohortsModal } from './ManageCohortsModal';

/**
 * Returns the owned Manage Cohorts modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Cohorts dialog.
 */
function getManageCohortsModalDialog() {
  return screen.getByRole('dialog', { name: 'Manage Cohorts' });
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
      expect(
        within(dialog).queryByRole('button', { name: /create cohort/i })
      ).not.toBeInTheDocument();
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
        expect(
          within(dialog).queryByRole('button', { name: /create cohort/i })
        ).not.toBeInTheDocument();
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
      getCohortsMock.mockImplementationOnce(() => {
        return new Promise<Cohort[]>((resolve) => {
          releaseRefresh = () => resolve(seedCohorts);
        });
      });

      try {
        await act(async () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
        });

        await waitFor(() => {
          expect(getCohortsMock).toHaveBeenCalledTimes(1);
          expect(dialog).toHaveAttribute('aria-busy', 'true');
        });
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

    it('exposes data-testid="reference-data-create-action-icon" on the create action', async () => {
      renderManageCohortsModal();
      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      expect(within(dialog).getByTestId('reference-data-create-action-icon')).toBeInTheDocument();
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
});
