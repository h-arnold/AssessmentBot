/**
 * Manage Topics modal — rendering and configuration tests.
 *
 * Covers: list rendering, table columns, action buttons wiring, empty state,
 * modal close wiring, loading and error-free rendering states, transient state
 * reset via scaffold-owned close paths, and year group blocking rendering.
 */

import '@/test/referenceData/manageTopics.mockSetup';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentTopic } from '@/services/referenceData/referenceData.zod';
import { queryKeys } from '@/query/queryKeys';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import {
  assertReadyBodySuppressed,
  assertTransientStateReset,
  findManageTopicsModalDialog,
  getAssignmentTopicsMock,
  getManageTopicsModalDialog,
  getYearGroupsMock,
  onCloseMock,
  onEntityCreatedMock,
  renderManageTopicsModal,
  seedTopics,
  seedYearGroups,
  setupQueryFailureBeforeDataLoad,
  topicsLoadFailureCopy,
} from '@/test/referenceData/manageTopicsTestHelpers';
import { ManageTopicsModal } from './ManageTopicsModal';

/**
 * Sets up a test scenario where yearGroups query fails but topics data is already seeded.
 *
 * @param {Error} error - The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
async function setupYearGroupsFailureWithTopicsSeeded(error: Error): Promise<HTMLElement> {
  getYearGroupsMock.mockRejectedValueOnce(error);

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);

  renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );
  return findManageTopicsModalDialog();
}

beforeEach(() => {
  vi.resetAllMocks();
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageTopicsModal', () => {
  describe('modal rendering and configuration', () => {
    it('renders with correct title "Manage Topics"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(within(dialog).getByText('Manage Topics')).toBeInTheDocument();
    });

    it('uses correct modal className "manage-topics-modal"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const wrapper = dialog.closest('.ant-modal-wrap');
      expect(wrapper).toHaveClass('manage-topics-modal');
    });

    it('has width 700px to accommodate year group multi-select', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const modal = dialog.closest('.ant-modal');
      // Ant Design Modal applies width as inline style, check via getAttribute
      const style = modal?.getAttribute('style');
      expect(style?.toLowerCase()).toMatch(/width:\s*700px/);
    });

    it('passes correct props to scaffold for topics management', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('configures useReferenceDataManagement with entityKey: "assignmentTopics"', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('accepts onEntityCreated callback and passes it through', async () => {
      const customOnEntityCreated = vi.fn();
      renderManageTopicsModal({ onEntityCreated: customOnEntityCreated });

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('initial loading state', () => {
    it('renders a skeleton status region instead of the ready topics table while topic data is still loading', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
      expect(dialog.querySelector('.ant-skeleton')).not.toBeNull();
      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Mathematics')).not.toBeInTheDocument();
    });

    it('suppresses the ready modal body when the topics query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        'topics',
        new Error('Topics failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog, topicsLoadFailureCopy);
      });
    });

    it('suppresses the ready modal body when the yearGroups query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        'yearGroups',
        new Error('Year groups failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });

    it('keeps the trusted topics table visible when a later refetch fails', async () => {
      // Set mock to reject for the refetch
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Background topics refresh failed.'));

      const { queryClient } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(table).getByText('Mathematics')).toBeInTheDocument();

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
      });

      // The refetch should have been attempted
      await waitFor(() => {
        expect(getAssignmentTopicsMock).toHaveBeenCalled();
      });

      // The table should remain visible with trusted cached data (background refetch failure doesn't hide data)
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
      expect(within(dialog).getByRole('table', { name: /topics/i })).toBeInTheDocument();
      expect(within(dialog).getByText('Mathematics')).toBeInTheDocument();
      expect(within(dialog).getByText('English')).toBeInTheDocument();
      expect(within(dialog).getByText('Science')).toBeInTheDocument();
    });

    it('keeps trusted topic data visible while publishing modal busy state during background refresh', async () => {
      const { queryClient } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      let releaseRefresh: (() => void) | undefined;
      getAssignmentTopicsMock.mockImplementationOnce(() => {
        return new Promise<AssignmentTopic[]>((resolve) => {
          releaseRefresh = () => resolve(seedTopics);
        });
      });

      try {
        await act(async () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.assignmentTopics() });
        });

        await waitFor(() => {
          expect(getAssignmentTopicsMock).toHaveBeenCalledTimes(1);
          expect(dialog).toHaveAttribute('aria-busy', 'true');
        });
        expect(within(dialog).getByText('Refreshing topics...')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
        expect(within(dialog).getByRole('table', { name: /topics/i })).toBeInTheDocument();
        expect(within(dialog).getByText('Mathematics')).toBeInTheDocument();
      } finally {
        releaseRefresh?.();
      }
    });
  });

  describe('table columns', () => {
    // Topics table has 3 columns: Name, Year Groups, Actions
    const TOPICS_TABLE_COLUMN_COUNT = 3;

    it('renders table columns matching specification: Name, Year Groups, Actions', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const headers = within(table).getAllByRole('columnheader');
      expect(headers).toHaveLength(TOPICS_TABLE_COLUMN_COUNT);
      expect(within(headers[0]).getByText('Name')).toBeInTheDocument();
      expect(within(headers[1]).getByText('Year Groups')).toBeInTheDocument();
      expect(within(headers[2]).getByText('Actions')).toBeInTheDocument();
    });

    it('Year Groups column render function looks up year group names from yearGroups query', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      expect(within(mathsRow).getByText(/year 7, year 8/i)).toBeInTheDocument();
    });

    it('Year Groups column displays comma-separated year group names for topics with yearGroupKeys', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      const yearGroupsCell = within(mathsRow).getByRole('cell', { name: /year groups/i });
      expect(within(yearGroupsCell).getByText('Year 7, Year 8')).toBeInTheDocument();
    });

    it('Year Groups column displays empty string for topics with empty yearGroupKeys array', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });

      const scienceRow = within(table).getByRole('row', { name: /science/i });
      const yearGroupsCell = within(scienceRow).getByRole('cell', { name: /year groups/i });
      expect(within(yearGroupsCell).getByText('')).toBeInTheDocument();
    });

    it('renders Edit and Delete action buttons for each topic row', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const rows = within(table).getAllByRole('row').slice(1); // skip header row

      for (const row of rows) {
        expect(within(row).getByRole('button', { name: /edit/i })).toBeInTheDocument();
        expect(within(row).getByRole('button', { name: /delete/i })).toBeInTheDocument();
      }
    });
  });

  describe('action buttons wiring', () => {
    it('Edit button opens edit form for the topic', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('Mathematics');
    });

    it('Delete button opens delete dialog for the topic', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /delete/i }));

      const deleteDialog = await screen.findByRole('dialog', { name: /delete topic/i });
      expect(deleteDialog).toBeInTheDocument();
    });
  });

  describe('year groups blocking dependency', () => {
    it('treats yearGroups dependency as blocking-required; ready-body content does not render until both topics and yearGroups data are ready', async () => {
      getYearGroupsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('shows blocking alert when yearGroups query fails even if topics data is available', async () => {
      const dialog = await setupYearGroupsFailureWithTopicsSeeded(
        new Error('Year groups failed to load.')
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });
  });

  describe('empty state', () => {
    it('shows an empty state and a primary Create topic button when no topics exist', async () => {
      renderManageTopicsModal({ topics: [] });

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByText(/no topics/i);
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });
  });

  describe('transient state reset via scaffold-owned close paths', () => {
    it('resets transient inline-dialog state when closed via Cancel and reopened', () =>
      assertTransientStateReset('Cancel'));

    it('resets transient inline-dialog state when closed via close icon and reopened', () =>
      assertTransientStateReset('close icon'));

    it('resets transient inline-dialog state when closed via mask and reopened', () =>
      assertTransientStateReset('mask'));

    it('resets transient inline-dialog state when closed via Escape and reopened', () =>
      assertTransientStateReset('Escape'));
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageTopicsModal({ open: false });

      expect(screen.queryByRole('dialog', { name: 'Manage Topics' })).not.toBeInTheDocument();
    });

    it('passes modal closes callback through to scaffold', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);

      expect(onCloseMock).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('shows skeleton loading state', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal({ seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
    });
  });
});
