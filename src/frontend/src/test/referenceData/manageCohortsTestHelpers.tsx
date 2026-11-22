/**
 * Shared fixtures and render helpers for the ManageCohortsModal specs.
 *
 * The three cohorts suites render the real modal against seeded React Query
 * caches. Keep the fixture values, dialog queries and close-path harness here
 * so each suite configures only its own scenarios.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, vi } from 'vitest';
import type { Cohort } from '@/services/referenceData/referenceData.zod';
import { queryKeys } from '@/query/queryKeys';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { StartupWarmupStateProvider } from '@/features/auth/startupWarmupState';
import { ManageCohortsModal } from '@/features/referenceData/ManageCohortsModal/ManageCohortsModal';
import {
  createCohort,
  getCohorts,
  updateCohort,
} from '@/services/referenceData/referenceDataService';

export const getCohortsMock = vi.mocked(getCohorts);
export const createCohortMock = vi.mocked(createCohort);
export const updateCohortMock = vi.mocked(updateCohort);

export const onCloseMock = vi.fn<() => void>();

export const cohortsLoadFailureCopy = 'Unable to load cohorts right now.';

export const seedCohorts: Cohort[] = [
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
const cohortCreateName = 'Cohort 2026';
const createCohortInputNameRegex = /name/i;
const cohortCreateSubmitButtonNameRegex = /ok|save|create/i;
const cohortCreateDialogNameRegex = /create cohort/i;
const refreshFailedErrorMessage = 'Refresh failed.';
export const createdCohortFixture: Cohort = {
  key: 'cohort-2026',
  name: cohortCreateName,
  active: true,
  startYear: 2026,
  startMonth: 9,
};

/**
 * Renders ManageCohortsModal with pre-seeded cohort data and optional overrides.
 *
 * @param {object} [options] Render options.
 * @param {boolean} [options.open] Whether the modal is open.
 * @param {boolean} [options.seedQueryData] Whether to seed the query cache before render.
 * @param {Cohort[]} [options.cohorts] Cohorts to seed in the query cache.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
export function renderManageCohortsModal(
  options: { open?: boolean; cohorts?: Cohort[]; seedQueryData?: boolean } = {}
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
 * Finds the owned Manage Cohorts modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Cohorts dialog.
 */
export function findManageCohortsModalDialog() {
  return screen.findByRole('dialog', { name: 'Manage Cohorts' });
}

/**
 * Closes the modal via the specified method.
 *
 * @param {object} options Close options.
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} options.closeMethod How to close the modal.
 * @param {HTMLElement} options.dialog The modal dialog element.
 * @param {string} options.modalTitle Modal title for finding the dialog.
 * @returns {Promise<void>}
 */
async function closeModalViaMethod(options: {
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape';
  dialog: HTMLElement;
  modalTitle: string;
}): Promise<void> {
  const { closeMethod, dialog, modalTitle } = options;

  switch (closeMethod) {
    case 'Cancel': {
      const footerCancel = screen
        .getAllByRole('button', { name: /cancel/i })
        .find((button) => button.closest('.ant-modal-footer') !== null);
      fireEvent.click(footerCancel!);
      break;
    }
    case 'close icon': {
      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);
      break;
    }
    case 'mask': {
      const mask = screen
        .getByRole('dialog', { name: modalTitle })
        .closest('.ant-modal-wrap')
        ?.querySelector('.ant-modal-mask');
      fireEvent.click(mask!);
      break;
    }
    case 'Escape': {
      fireEvent.keyDown(screen.getByRole('dialog', { name: modalTitle }), {
        key: 'Escape',
        code: 'Escape',
      });
      break;
    }
    default: {
      throw new Error(`Unknown close method: ${closeMethod}`);
    }
  }
}

/**
 * Tests that transient inline-dialog state is reset when modal closes and reopens.
 *
 * Encapsulates the common pattern for testing transient state reset:
 * 1. Sets up queryClient with seed data
 * 2. Renders the modal
 * 3. Opens the create dialog
 * 4. Closes via the specified method
 * 5. Reopens the modal
 * 6. Verifies clean state (table visible, create form not visible)
 *
 * @param {object} options Test options.
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} options.closeMethod How to close the modal.
 * @param {string} [options.modalTitle='Manage Cohorts'] Modal title for finding the dialog.
 * @param {Cohort[]} [options.seedData=seedCohorts] Seed data for queryClient.
 * @returns {Promise<void>}
 */
export async function assertTransientStateReset(options: {
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape';
  modalTitle?: string;
  seedData?: Cohort[];
}): Promise<void> {
  const { closeMethod, modalTitle = 'Manage Cohorts', seedData = seedCohorts } = options;

  // Setup queryClient with seed data
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.cohorts(), seedData);
  getCohortsMock.mockResolvedValue(seedData);

  // Render modal
  const { rerender } = renderWithFrontendProviders(
    <ManageCohortsModal open={true} onClose={onCloseMock} />,
    { queryClient }
  );

  const dialog = await screen.findByRole('dialog', { name: modalTitle });

  // Open create dialog
  fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));
  await screen.findByRole('dialog', { name: /create cohort/i });

  // Close via specified method
  await closeModalViaMethod({ closeMethod, dialog, modalTitle });
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
  const reopenedDialog = await screen.findByRole('dialog', { name: modalTitle });

  // Verify clean state: table visible, create form not visible
  await within(reopenedDialog).findByRole('table', { name: /cohorts/i });
  expect(screen.queryByRole('dialog', { name: /create cohort/i })).not.toBeInTheDocument();
}

/**
 * Opens and submits the Create cohort dialog while forcing the post-mutation refresh to fail.
 *
 * @param {HTMLElement} dialog The outer Manage Cohorts modal dialog.
 * @returns {Promise<void>} Resolves once create submission has been asserted.
 */
export async function submitCreateCohortWhenRefreshFails(dialog: HTMLElement) {
  getCohortsMock.mockRejectedValueOnce(new Error(refreshFailedErrorMessage));
  fireEvent.click(within(dialog).getByRole('button', { name: /create cohort/i }));

  const formDialog = await screen.findByRole('dialog', { name: cohortCreateDialogNameRegex });
  fireEvent.change(within(formDialog).getByRole('textbox', { name: createCohortInputNameRegex }), {
    target: { value: cohortCreateName },
  });
  fireEvent.click(
    within(formDialog).getByRole('button', { name: cohortCreateSubmitButtonNameRegex })
  );

  await waitFor(() => {
    expect(createCohortMock).toHaveBeenCalledWith({
      record: expect.objectContaining({ name: cohortCreateName }),
    });
  });
}
