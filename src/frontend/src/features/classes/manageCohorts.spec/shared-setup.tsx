/**
 * Cohort management modal — shared setup, helpers, mocks, and test data.
 *
 * Exports meant for consumption by index.spec.tsx in this directory.
 * Hoisted mocks and vi.mock calls live in index.spec.tsx to avoid
 * hoisting conflicts with re-exports.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import { expect, vi } from 'vitest';
import type { Cohort } from '../../../services/referenceData.zod';

// ---------------------------------------------------------------------------
// Shared mocks & constants
// ---------------------------------------------------------------------------

export const onCloseMock = vi.fn();
export const cohortsLoadFailureCopy = 'Unable to load cohorts right now.';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

export const cohortCreateName = 'Cohort 2026';
export const createCohortInputNameRegex = /name/i;
export const cohortCreateSubmitButtonNameRegex = /ok|save|create/i;
export const cohortCreateDialogNameRegex = /create cohort/i;
export const refreshFailedErrorMessage = 'Refresh failed.';

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
export const createdCohortFixture: Cohort = {
  key: 'cohort-2026',
  name: cohortCreateName,
  active: true,
  startYear: 2026,
  startMonth: 9,
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Returns the owned Manage Cohorts modal dialog region.
 * @returns {HTMLElement} The outer Manage Cohorts dialog.
 */
export function getManageCohortsModalDialog() {
  return screen.getByRole('dialog', { name: 'Manage Cohorts' });
}

/**
 * Finds the owned Manage Cohorts modal dialog region.
 * @returns {Promise<HTMLElement>} The outer Manage Cohorts dialog.
 */
export async function findManageCohortsModalDialog() {
  return screen.findByRole('dialog', { name: 'Manage Cohorts' });
}

// ---------------------------------------------------------------------------
// Close helper (internal)
// ---------------------------------------------------------------------------

/**
 * Closes the modal via the specified method.
 * @param {object} options Close options.
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} options.closeMethod How to close the modal.
 * @param {HTMLElement} options.dialog The modal dialog element.
 * @param {string} options.modalTitle Modal title for finding the dialog.
 * @returns {Promise<void>}
 */
export async function closeModalViaMethod(options: {
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape';
  dialog: HTMLElement;
  modalTitle: string;
}): Promise<void> {
  const { closeMethod, dialog, modalTitle } = options;

  switch (closeMethod) {
    case 'Cancel': {
      const footerCancel = screen.getAllByRole('button', { name: /cancel/i }).find(
        (button) => button.closest('.ant-modal-footer') !== null
      );
      expect(footerCancel).toBeDefined();
      fireEvent.click(footerCancel!);
      break;
    }
    case 'close icon': {
      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);
      break;
    }
    case 'mask': {
      const mask = screen.getByRole('dialog', { name: modalTitle }).closest('.ant-modal-wrap')?.querySelector('.ant-modal-mask');
      expect(mask).toBeDefined();
      fireEvent.click(mask!);
      break;
    }
    case 'Escape': {
      fireEvent.keyDown(screen.getByRole('dialog', { name: modalTitle }), { key: 'Escape', code: 'Escape' });
      break;
    }
    default: {
      throw new Error(`Unknown close method: ${closeMethod}`);
    }
  }
}
