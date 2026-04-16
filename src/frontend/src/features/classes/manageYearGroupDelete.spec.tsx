/**
 * Year-group delete flow — unit tests.
 *
 * Covers: delete confirmation wiring, successful delete invalidating the yearGroups query,
 * delete-blocked (IN_USE) state keeping the modal open with an inline Alert and a
 * disabled destructive button, and generic failure rendering.
 *
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../services/referenceData.zod';
import { ApiTransportError } from '../../errors/apiTransportError';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ManageYearGroupsModal } from './ManageYearGroupsModal';

const deleteYearGroupMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getYearGroups: vi.fn(),
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: deleteYearGroupMock,
}));

const onCloseMock = vi.fn();

const seedYearGroups: YearGroup[] = [
  { key: 'year-alpha', name: 'Year Alpha' },
  { key: 'year-beta', name: 'Year Beta' },
];

/**
 * Builds an ApiTransportError representing a blocked delete (year group in use).
 *
 * @param {string} [code] Error code from the API envelope.
 * @returns {ApiTransportError} Transport error with the given code.
 */
function buildDeleteBlockedError(code = 'IN_USE'): ApiTransportError {
  return new ApiTransportError({
    requestId: 'req-delete-blocked',
    error: {
      code,
      message: 'Year group is in use by one or more classes and cannot be deleted.',
      retriable: false,
    },
  });
}

/**
 * Renders ManageYearGroupsModal with pre-seeded year-group data.
 *
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageYearGroupsModal() {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.yearGroups(), seedYearGroups);

  return renderWithFrontendProviders(
    <ManageYearGroupsModal open={true} onClose={onCloseMock} />,
    { queryClient },
  );
}

/**
 * Opens the delete confirmation for the first year-group row.
 *
 * @returns {Promise<void>} Resolves when the confirmation dialog is open.
 */
async function openDeleteConfirmationForFirstRow(): Promise<void> {
  const table = await screen.findByRole('table', { name: /year groups/i });
  const firstDataRow = within(table).getAllByRole('row')[1];
  fireEvent.click(within(firstDataRow).getByRole('button', { name: /delete/i }));
  await screen.findByRole('dialog', { name: /delete year group/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ManageYearGroupsModal — delete flow', () => {
  describe('delete confirmation wiring', () => {
    it('opens a delete confirmation dialog when the Delete row action is clicked', async () => {
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();

      expect(screen.getByRole('dialog', { name: /delete year group/i })).toBeInTheDocument();
    });

    it('does not call deleteYearGroup before the user confirms', async () => {
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();

      expect(deleteYearGroupMock).not.toHaveBeenCalled();
    });
  });

  describe('successful delete', () => {
    it('calls deleteYearGroup with the correct year-group key on confirmation', async () => {
      deleteYearGroupMock.mockImplementation(async () => {});
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(deleteYearGroupMock).toHaveBeenCalledWith(
          expect.objectContaining({ key: seedYearGroups[0].key }),
        );
      });
    });

    it('closes the delete confirmation after a successful delete', async () => {
      deleteYearGroupMock.mockImplementation(async () => {});
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /delete year group/i })).not.toBeInTheDocument();
      });
    });

    it('invalidates the yearGroups query after a successful delete', async () => {
      deleteYearGroupMock.mockImplementation(async () => {});
      const { queryClient } = renderManageYearGroupsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.yearGroups(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('blocked delete — year group in use', () => {
    it('keeps the delete confirmation open when the API returns an IN_USE error', async () => {
      deleteYearGroupMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /delete year group/i })).toBeInTheDocument();
      });
    });

    it('shows an inline Alert explaining that the year group is in use when delete is blocked', async () => {
      deleteYearGroupMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/in use/i);
    });

    it('disables the destructive delete button when the year group is blocked', async () => {
      deleteYearGroupMock.mockRejectedValue(buildDeleteBlockedError('IN_USE'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('button', { name: /delete|confirm|ok/i })).toBeDisabled();
    });
  });

  describe('generic delete failure', () => {
    it('shows error feedback inside the dialog when a non-blocked delete fails', async () => {
      deleteYearGroupMock.mockRejectedValue(new Error('Unexpected server error'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
    });

    it('keeps the delete confirmation open after a generic failure', async () => {
      deleteYearGroupMock.mockRejectedValue(new Error('Unexpected server error'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: /delete year group/i })).toBeInTheDocument();
    });

    it('keeps the destructive delete button enabled after a generic failure so the user can retry', async () => {
      deleteYearGroupMock.mockRejectedValue(new Error('Unexpected server error'));
      renderManageYearGroupsModal();

      await openDeleteConfirmationForFirstRow();
      const dialog = screen.getByRole('dialog', { name: /delete year group/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /delete|confirm|ok/i }));

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
      expect(within(dialog).getByRole('button', { name: /delete|confirm|ok/i })).toBeEnabled();
    });
  });
});
