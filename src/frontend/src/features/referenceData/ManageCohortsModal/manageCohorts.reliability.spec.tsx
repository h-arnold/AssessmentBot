/**
 * Cohort management modal — required refresh, transient state and close tests.
 *
 * Covers: fail-closed state and remount persistence after a required refresh
 * fails, transient state reset via scaffold-owned close paths, toggle-error
 * alert clearing after reopen, and modal close wiring.
 */

import '@/test/referenceData/manageCohorts.mockSetup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/query/queryKeys';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { StartupWarmupStateProvider } from '@/features/auth/startupWarmupState';
import {
  assertTransientStateReset,
  cohortsLoadFailureCopy,
  createCohortMock,
  createdCohortFixture,
  findManageCohortsModalDialog,
  getCohortsMock,
  onCloseMock,
  renderManageCohortsModal,
  seedCohorts,
  submitCreateCohortWhenRefreshFails,
  updateCohortMock,
} from '@/test/referenceData/manageCohortsTestHelpers';
import { ManageCohortsModal } from './ManageCohortsModal';

beforeEach(() => {
  vi.clearAllMocks();
  getCohortsMock.mockResolvedValue(seedCohorts);
});

describe('ManageCohortsModal', () => {
  describe('required refresh failures', () => {
    it('fails closed when a successful create cannot refresh the now-invalid cohorts data', async () => {
      createCohortMock.mockResolvedValue(createdCohortFixture);

      renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      await submitCreateCohortWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /create cohort/i })).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /create cohort/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
    });

    it('keeps the fail-closed cohorts state blocked after remount while the cached data is still untrustworthy', async () => {
      createCohortMock.mockResolvedValue(createdCohortFixture);

      const { queryClient, unmount } = renderManageCohortsModal();

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      await submitCreateCohortWhenRefreshFails(dialog);

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      });

      unmount();
      renderWithFrontendProviders(<ManageCohortsModal open={true} onClose={onCloseMock} />, {
        queryClient,
      });

      const remountedDialog = await findManageCohortsModalDialog();
      expect(within(remountedDialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      expect(
        within(remountedDialog).queryByRole('button', { name: /create cohort/i })
      ).not.toBeInTheDocument();
      expect(
        within(remountedDialog).queryByRole('table', { name: /cohorts/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('transient state reset via scaffold-owned close paths', () => {
    it('resets transient inline-dialog state when closed via Cancel and reopened', () =>
      assertTransientStateReset({ closeMethod: 'Cancel' }));

    it('resets transient inline-dialog state when closed via close icon and reopened', () =>
      assertTransientStateReset({ closeMethod: 'close icon' }));
  });

  describe('toggle-error alert clearing', () => {
    it('clears toggle-error alert when modal closes through scaffold-owned close path and does not persist after reopen', async () => {
      const queryClient = createAppQueryClient();
      const cohortData = [
        {
          key: 'cohort-1',
          name: 'Cohort 1',
          active: true,
          startYear: 2025,
          startMonth: 9,
        },
      ];
      queryClient.setQueryData(queryKeys.cohorts(), cohortData);
      getCohortsMock.mockResolvedValue(cohortData);

      const { rerender } = renderWithFrontendProviders(
        <ManageCohortsModal open={true} onClose={onCloseMock} />,
        { queryClient }
      );

      const dialog = await findManageCohortsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /cohorts/i });

      // Trigger a toggle error by simulating a failed toggle
      const activeRow = within(table).getByRole('row', { name: /cohort 1/i });
      updateCohortMock.mockRejectedValueOnce(new Error('Toggle failed'));
      fireEvent.click(within(activeRow).getByRole('switch'));

      // Wait for the toggle error to appear
      await waitFor(() => {
        const alert = within(dialog).getByRole('alert');
        expect(alert).toBeInTheDocument();
        // The error message from the mocked rejection is 'Toggle failed'
        expect(alert.textContent).toContain('Toggle failed');
      });

      // Close via Cancel (scaffold-owned) - use the outer modal's Cancel button in the footer
      // We need to get the Cancel button from the footer of the outer modal, not from the inline dialog
      const footerCancel = within(dialog)
        .getAllByRole('button', { name: /cancel/i })
        .find((button) => button.closest('.ant-modal-footer') !== null);
      fireEvent.click(footerCancel!);
      expect(onCloseMock).toHaveBeenCalledOnce();

      // Reopen modal
      onCloseMock.mockClear();
      rerender(
        <QueryClientProvider client={queryClient}>
          <StartupWarmupStateProvider warmupState="ready">
            <ManageCohortsModal open={true} onClose={onCloseMock} />
          </StartupWarmupStateProvider>
        </QueryClientProvider>
      );
      const reopenedDialog = await findManageCohortsModalDialog();

      // Verify toggle error is not present
      expect(within(reopenedDialog).queryByRole('alert')).not.toBeInTheDocument();
      await within(reopenedDialog).findByRole('table', { name: /cohorts/i });
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
