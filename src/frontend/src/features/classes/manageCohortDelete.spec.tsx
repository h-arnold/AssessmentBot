/**
 * Cohort delete flow — unit tests.
 *
 * Covers: delete confirmation wiring, successful delete refetching the active cohorts query,
 * required refresh failures, delete-blocked (IN_USE) state keeping the modal open with an
 * inline Alert and a disabled destructive button, and generic failure rendering.
 *
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '../../services/referenceData.zod';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ManageCohortsModal } from './ManageCohortsModal';

const deleteCohortMock = vi.hoisted(() => vi.fn());
const getCohortsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: deleteCohortMock,
  getYearGroups: vi.fn(),
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: vi.fn(),
}));

const onCloseMock = vi.fn();
const cohortsLoadFailureCopy = 'Unable to load cohorts right now.';

const seedCohorts: Cohort[] = [
  {
    key: 'cohort-alpha',
    name: 'Alpha Cohort',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  {
    key: 'cohort-beta',
    name: 'Beta Cohort',
    active: false,
    startYear: 2024,
    startMonth: 1,
  },
];

/**
 * Builds an ApiTransportError representing a blocked delete (cohort in use).
 *
 * @param {string} [code] Error code from the API envelope.
 * @returns {ApiTransportError} Transport error with the given code.
 */
function buildDeleteBlockedError(code = 'IN_USE'): ApiTransportError {
  return new ApiTransportError({
    requestId: 'req-delete-blocked',
    error: {
      code,
      message: 'Cohort is in use by one or more classes and cannot be deleted.',
      retriable: false,
    },
  });
}

/**
 * Renders ManageCohortsModal with pre-seeded cohort data.
 *
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageCohortsModal() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.cohorts(), seedCohorts);

  return renderWithFrontendProviders(<ManageCohortsModal open={true} onClose={onCloseMock} />, {
    queryClient,
  });
}

/**
 * Opens the delete confirmation for the first cohort row.
 *
 * @returns {Promise<void>} Resolves when the confirmation dialog is open.
 */
async function openDeleteConfirmationForFirstRow(): Promise<void> {
  const table = await screen.findByRole('table', { name: /cohorts/i });
  const firstDataRow = within(table).getAllByRole('row')[1];
  fireEvent.click(within(firstDataRow).getByRole('button', { name: /delete/i }));
  await screen.findByRole('dialog', { name: /delete cohort/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCohortsMock.mockResolvedValue(seedCohorts);
});

describe('ManageCohortsModal — delete flow', () => {
  describe('delete confirmation wiring', () => {
    it('opens a delete confirmation dialog when the Delete row action is clicked', async () => {
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();

      expect(screen.getByRole('dialog', { name: /delete cohort/i })).toBeInTheDocument();
    });

    it('does not call deleteCohort before the user confirms', async () => {
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();

      expect(deleteCohortMock).not.toHaveBeenCalled();
    });
  });

  describe('successful delete', () => {
    it('calls deleteCohort with the correct cohort key on confirmation', async () => {
      deleteCohortMock.mockImplementation(async () => {});
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(deleteCohortMock).toHaveBeenCalledWith(
          expect.objectContaining({ key: seedCohorts[0].key }),
        );
      });
    });

    it('closes the delete confirmation after a successful delete', async () => {
      deleteCohortMock.mockImplementation(async () => {});
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /delete cohort/i })).not.toBeInTheDocument();
      });
    });

    it('refetches the active cohorts query after a successful delete', async () => {
      deleteCohortMock.mockImplementation(async () => {});
      const { queryClient } = renderManageCohortsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

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

  describe('required refresh failure after successful delete', () => {
    it('fails closed when a successful delete cannot refresh the invalidated cohorts data', async () => {
      deleteCohortMock.mockImplementation(async () => {});
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /manage cohorts/i });
      const deleteDialog = screen.getByRole('dialog', { name: /delete cohort/i });
      getCohortsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(deleteDialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(cohortsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /delete cohort/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /cohorts/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /create cohort/i })).not.toBeInTheDocument();
    });
  });

  describe('blocked delete — cohort in use', () => {
    it('keeps the delete confirmation open when the API returns an IN_USE error', async () => {
      deleteCohortMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /delete cohort/i })).toBeInTheDocument();
      });
    });

    it('shows an inline Alert explaining that the cohort is in use when delete is blocked', async () => {
      deleteCohortMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/in use/i);
    });

    it('disables the destructive delete button when the cohort is blocked', async () => {
      deleteCohortMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('button', { name: /delete|confirm|ok/i })).toBeDisabled();
    });
  });

  describe('generic delete failure', () => {
    it('shows error feedback inside the dialog when a non-blocked delete fails', async () => {
      deleteCohortMock.mockRejectedValue(new Error('Unexpected server error'));
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
    });

    it('keeps the delete confirmation open after a generic failure', async () => {
      deleteCohortMock.mockRejectedValue(new Error('Unexpected server error'));
      renderManageCohortsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete cohort/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: /delete cohort/i })).toBeInTheDocument();
    });
  });
});
