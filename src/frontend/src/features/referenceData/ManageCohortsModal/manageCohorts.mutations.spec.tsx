/**
 * Cohort management modal — create, edit and active-state toggle tests.
 *
 * Covers: pre-filled edit form, successful edit and required refresh,
 * successful create and required refresh, and the active-state switch.
 */

import '@/test/referenceData/manageCohorts.mockSetup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cohort } from '@/services/referenceData/referenceData.zod';
import { queryKeys } from '@/query/queryKeys';
import {
  createCohortMock,
  createdCohortFixture,
  findManageCohortsModalDialog,
  getCohortsMock,
  renderManageCohortsModal,
  seedCohorts,
  submitCreateCohortWhenRefreshFails,
  updateCohortMock,
} from '@/test/referenceData/manageCohortsTestHelpers';

beforeEach(() => {
  vi.clearAllMocks();
  getCohortsMock.mockResolvedValue(seedCohorts);
});

describe('ManageCohortsModal', () => {
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
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });

  describe('create flow', () => {
    it('calls createCohort and refetches the active cohorts query after a successful create', async () => {
      createCohortMock.mockResolvedValue(createdCohortFixture);

      const { queryClient } = renderManageCohortsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageCohortsModalDialog();
      await within(dialog).findByRole('table', { name: /cohorts/i });
      await submitCreateCohortWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.cohorts(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
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
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });
});
