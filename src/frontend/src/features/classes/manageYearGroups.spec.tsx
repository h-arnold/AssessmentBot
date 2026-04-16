/**
 * Year-group management modal — unit tests.
 *
 * Covers: list rendering, empty state, create/edit form launch,
 * query invalidation after successful mutations, and modal close wiring.
 *
 * Covers the current green ManageYearGroupsModal implementation and its query invalidation
 * behaviour for year-group management flows.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../services/referenceData.zod';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ManageYearGroupsModal } from './ManageYearGroupsModal';

const createYearGroupMock = vi.hoisted(() => vi.fn());
const updateYearGroupMock = vi.hoisted(() => vi.fn());
const getYearGroupsMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getYearGroups: getYearGroupsMock,
  createYearGroup: createYearGroupMock,
  updateYearGroup: updateYearGroupMock,
  deleteYearGroup: vi.fn(),
}));

const onCloseMock = vi.fn();

const seedYearGroups: YearGroup[] = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
];

/**
 * Renders ManageYearGroupsModal with pre-seeded year-group data and optional overrides.
 *
 * @param {object} [options] Render options.
 * @param {boolean} [options.open] Whether the modal is open.
 * @param {boolean} [options.seedQueryData] Whether to seed the query cache before render.
 * @param {YearGroup[]} [options.yearGroups] Year groups to seed in the query cache.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageYearGroupsModal(
  options: { open?: boolean; seedQueryData?: boolean; yearGroups?: YearGroup[] } = {},
) {
  const { open = true, seedQueryData = true, yearGroups = seedYearGroups } = options;
  const queryClient = createAppQueryClient();

  if (seedQueryData) {
    queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  }
  getYearGroupsMock.mockResolvedValue(yearGroups);

  return renderWithFrontendProviders(
    <ManageYearGroupsModal open={open} onClose={onCloseMock} />,
    { queryClient },
  );
}


/**
 * Returns the owned Manage Year Groups modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Year Groups dialog.
 */
function getManageYearGroupsModalDialog() {
  return screen.getByRole('dialog', { name: 'Manage Year Groups' });
}

/**
 * Finds the owned Manage Year Groups modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Year Groups dialog.
 */
async function findManageYearGroupsModalDialog() {
  return screen.findByRole('dialog', { name: 'Manage Year Groups' });
}

beforeEach(() => {
  vi.clearAllMocks();
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageYearGroupsModal', () => {
  describe('initial loading state', () => {
    it('renders a skeleton status region instead of the ready year-group table while year-group data is still loading', () => {
      getYearGroupsMock.mockImplementation(() => new Promise(() => {}));

      renderManageYearGroupsModal({ seedQueryData: false });
      const dialog = getManageYearGroupsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading year groups' })).toBeInTheDocument();
      expect(dialog.querySelector('.ant-skeleton')).not.toBeNull();
      expect(within(dialog).queryByRole('button', { name: /create year group/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /year groups/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Year 7')).not.toBeInTheDocument();
    });
  });

  describe('list rendering', () => {
    it('renders a table listing year groups with a name column', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /year groups/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Year 7')).toBeInTheDocument();
      expect(within(table).getByText('Year 8')).toBeInTheDocument();
    });

    it('renders Edit and Delete action buttons for each year-group row', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /year groups/i });
      const rows = within(table).getAllByRole('row').slice(1); // skip header row

      for (const row of rows) {
        expect(within(row).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      }
    });
  });

  describe('empty state', () => {
    it('shows an empty state and a primary Create year group button when no year groups exist', async () => {
      renderManageYearGroupsModal({ yearGroups: [] });

      const dialog = await findManageYearGroupsModalDialog();
      await within(dialog).findByText(/no year groups/i);
      expect(within(dialog).getByRole('button', { name: /create year group/i })).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('renders a Create year group button when year groups are listed', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      await within(dialog).findByRole('table', { name: /year groups/i });
      expect(within(dialog).getByRole('button', { name: /create year group/i })).toBeInTheDocument();
    });

    it('opens a blank year-group form dialog when the Create year group button is clicked', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      await within(dialog).findByRole('table', { name: /year groups/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /create year group/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create year group/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled year-group form dialog when an Edit button is clicked', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /year groups/i });
      const firstDataRow = within(table).getAllByRole('row')[1];
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit year group/i });
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('calls updateYearGroup and invalidates the yearGroups query after a successful edit', async () => {
      const updatedYearGroup: YearGroup = { ...seedYearGroups[0], name: 'Year 7 Updated' };
      updateYearGroupMock.mockResolvedValue(updatedYearGroup);

      const { queryClient } = renderManageYearGroupsModal();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const dialog = await findManageYearGroupsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /year groups/i });
      const firstDataRow = within(table).getAllByRole('row')[1];
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit year group/i });
      const nameInput = within(formDialog).getByRole('textbox', { name: /name/i });
      fireEvent.change(nameInput, { target: { value: 'Year 7 Updated' } });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|update/i }));

      await waitFor(() => {
        expect(updateYearGroupMock).toHaveBeenCalledWith({
          key: seedYearGroups[0].key,
          record: expect.objectContaining({ name: 'Year 7 Updated' }),
        });
      });
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: queryKeys.yearGroups() }),
        );
      });
    });
  });

  describe('create flow', () => {
    it('calls createYearGroup and invalidates the yearGroups query after a successful create', async () => {
      const newYearGroup: YearGroup = { key: 'year-9', name: 'Year 9' };
      createYearGroupMock.mockResolvedValue(newYearGroup);

      const { queryClient } = renderManageYearGroupsModal();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const dialog = await findManageYearGroupsModalDialog();
      await within(dialog).findByRole('table', { name: /year groups/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /create year group/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create year group/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: 'Year 9' },
      });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|create/i }));

      await waitFor(() => {
        expect(createYearGroupMock).toHaveBeenCalledWith({
          record: expect.objectContaining({ name: 'Year 9' }),
        });
      });
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: queryKeys.yearGroups() }),
        );
      });
    });
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageYearGroupsModal();

      const dialog = await findManageYearGroupsModalDialog();
      await within(dialog).findByRole('table', { name: /year groups/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageYearGroupsModal({ open: false });

      expect(screen.queryByRole('dialog', { name: 'Manage Year Groups' })).not.toBeInTheDocument();
    });
  });
});
