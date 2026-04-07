/**
 * Year-group management modal — unit tests.
 *
 * Covers: list rendering, empty state, create/edit form launch,
 * query invalidation after successful mutations, and modal close wiring.
 *
 * RED PHASE: ManageYearGroupsModal does not yet exist; these tests are expected to fail
 * with module-not-found errors until the component is implemented.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { YearGroup } from '../../services/referenceData.zod';
import { queryKeys } from '../../query/queryKeys';
import { createAppQueryClient } from '../../query/queryClient';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
// RED: ManageYearGroupsModal does not exist yet — import fails in the red phase.
import { ManageYearGroupsModal } from './ManageYearGroupsModal';

const createYearGroupMock = vi.hoisted(() => vi.fn());
const updateYearGroupMock = vi.hoisted(() => vi.fn());

vi.mock('../../services/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getYearGroups: vi.fn(),
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
 * @param {YearGroup[]} [options.yearGroups] Year groups to seed in the query cache.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderManageYearGroupsModal(
  options: { open?: boolean; yearGroups?: YearGroup[] } = {},
) {
  const { open = true, yearGroups = seedYearGroups } = options;
  const queryClient = createAppQueryClient();

  queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);

  return renderWithFrontendProviders(
    <ManageYearGroupsModal open={open} onClose={onCloseMock} />,
    { queryClient },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ManageYearGroupsModal', () => {
  describe('list rendering', () => {
    it('renders a table listing year groups with a name column', async () => {
      renderManageYearGroupsModal();

      const table = await screen.findByRole('table', { name: /year groups/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('Year 7')).toBeInTheDocument();
      expect(within(table).getByText('Year 8')).toBeInTheDocument();
    });

    it('renders Edit and Delete action buttons for each year-group row', async () => {
      renderManageYearGroupsModal();

      const table = await screen.findByRole('table', { name: /year groups/i });
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

      await screen.findByText(/no year groups/i);
      expect(screen.getByRole('button', { name: /create year group/i })).toBeInTheDocument();
    });
  });

  describe('create button', () => {
    it('renders a Create year group button when year groups are listed', async () => {
      renderManageYearGroupsModal();

      await screen.findByRole('table', { name: /year groups/i });
      expect(screen.getByRole('button', { name: /create year group/i })).toBeInTheDocument();
    });

    it('opens a blank year-group form dialog when the Create year group button is clicked', async () => {
      renderManageYearGroupsModal();

      await screen.findByRole('table', { name: /year groups/i });
      fireEvent.click(screen.getByRole('button', { name: /create year group/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create year group/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled year-group form dialog when an Edit button is clicked', async () => {
      renderManageYearGroupsModal();

      const table = await screen.findByRole('table', { name: /year groups/i });
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

      const table = await screen.findByRole('table', { name: /year groups/i });
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

      await screen.findByRole('table', { name: /year groups/i });
      fireEvent.click(screen.getByRole('button', { name: /create year group/i }));

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

      await screen.findByRole('table', { name: /year groups/i });
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageYearGroupsModal({ open: false });

      expect(screen.queryByRole('table', { name: /year groups/i })).not.toBeInTheDocument();
    });
  });
});
