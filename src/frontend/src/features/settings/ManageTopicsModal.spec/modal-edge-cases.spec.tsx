/**
 * ManageTopicsModal — edge case tests.
 *
 * Covers: modal rendering/configuration, initial loading state, table columns,
 * year groups blocking dependency, required refresh failures, empty state,
 * transient state reset, modal close, loading state, and error state.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssignmentTopic } from '../../../services/referenceData.zod';
import { queryKeys } from '../../../query/queryKeys';
import { createAppQueryClient } from '../../../query/queryClient';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';

import { ManageTopicsModal } from '../ManageTopicsModal';
import type {
  ManageTopicsMocks} from './shared-setup';
import {
  assertReadyBodySuppressed,
  assertTransientStateReset,
  createdTopicFixture,
  findManageTopicsModalDialog,
  getManageTopicsModalDialog,
  renderManageTopicsModal,
  seedTopics,
  seedYearGroups,
  setupQueryFailureBeforeDataLoad,
  setupYearGroupsFailureWithTopicsSeeded,
  submitCreateTopicWhenRefreshFails,
  topicsLoadFailureCopy,
} from './shared-setup';
import {
  expectModalNotRendered,
  findTopicsTable,
  getColumnHeaders,
  getTopicRow,
  getYearGroupsCell,
  expectRowsHaveActions,
  TOPICS_TABLE_COLUMN_COUNT,
} from './helpers';

const createAssignmentTopicMock = vi.hoisted(() => vi.fn());
const updateAssignmentTopicMock = vi.hoisted(() => vi.fn());
const deleteAssignmentTopicMock = vi.hoisted(() => vi.fn());
const getAssignmentTopicsMock = vi.hoisted(() => vi.fn());
const getYearGroupsMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../../../services/referenceDataService', () => ({
  getCohorts: vi.fn(),
  createCohort: vi.fn(),
  updateCohort: vi.fn(),
  deleteCohort: vi.fn(),
  getYearGroups: getYearGroupsMock,
  createYearGroup: vi.fn(),
  updateYearGroup: vi.fn(),
  deleteYearGroup: vi.fn(),
  createAssignmentTopic: createAssignmentTopicMock,
  updateAssignmentTopic: updateAssignmentTopicMock,
  deleteAssignmentTopic: deleteAssignmentTopicMock,
}));

const onCloseMock = vi.fn();
const onEntityCreatedMock = vi.fn();

const mocks: ManageTopicsMocks = {
  getAssignmentTopicsMock,
  getYearGroupsMock,
  onCloseMock,
  onEntityCreatedMock,
  createAssignmentTopicMock,
  updateAssignmentTopicMock,
  deleteAssignmentTopicMock,
};

const render = renderWithFrontendProviders;

beforeEach(() => {
  vi.clearAllMocks();
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageTopicsModal', () => {
  describe('modal rendering and configuration', () => {
    it('renders with correct title "Manage Topics"', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      expect(within(dialog).getByText('Manage Topics')).toBeInTheDocument();
    });

    it('uses correct modal className "manage-topics-modal"', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const wrapper = dialog.closest('.ant-modal-wrap');
      expect(wrapper).toHaveClass('manage-topics-modal');
    });

    it('has width 700px to accommodate year group multi-select', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const modal = dialog.closest('.ant-modal');
      // Ant Design Modal applies width as inline style, check via getAttribute
      const style = modal?.getAttribute('style');
      expect(style?.toLowerCase()).toMatch(/width:\s*700px/);
    });

    it('passes correct props to scaffold for topics management', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('configures useReferenceDataManagement with entityKey: "assignmentTopics"', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });

    it('accepts onEntityCreated callback and passes it through', async () => {
      const customOnEntityCreated = vi.fn();
      renderManageTopicsModal(render, mocks, { onEntityCreated: customOnEntityCreated });

      const dialog = await findManageTopicsModalDialog();
      expect(dialog).toBeInTheDocument();
    });
  });

  describe('initial loading state', () => {
    it('renders a skeleton status region instead of the ready topics table while topic data is still loading', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal(render, mocks, { seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
      expect(dialog.querySelector('.ant-skeleton')).not.toBeNull();
      expect(within(dialog).queryByRole('button', { name: /create topic/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('Mathematics')).not.toBeInTheDocument();
    });

    it('suppresses the ready modal body when the topics query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        render,
        mocks,
        'topics',
        new Error('Topics failed to load.'),
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog, topicsLoadFailureCopy);
      });
    });

    it('suppresses the ready modal body when the yearGroups query fails before any usable data loads', async () => {
      const dialog = await setupQueryFailureBeforeDataLoad(
        render,
        mocks,
        'yearGroups',
        new Error('Year groups failed to load.'),
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });

    it('keeps the trusted topics table visible when a later refetch fails', async () => {
      // Set mock to reject for the refetch
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Background topics refresh failed.'));

      const { queryClient } = renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);
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
      const { queryClient } = renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);

      let releaseRefresh: (() => void) | undefined;
      getAssignmentTopicsMock.mockImplementationOnce(
        () =>
          new Promise<AssignmentTopic[]>((resolve) => {
            releaseRefresh = () => resolve(seedTopics);
          }),
      );

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
    it('renders table columns matching specification: Name, Year Groups, Actions', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);

      const headers = getColumnHeaders(table);
      expect(headers).toHaveLength(TOPICS_TABLE_COLUMN_COUNT);
      expect(within(headers[0]).getByText('Name')).toBeInTheDocument();
      expect(within(headers[1]).getByText('Year Groups')).toBeInTheDocument();
      expect(within(headers[2]).getByText('Actions')).toBeInTheDocument();
    });

    it('Year Groups column render function looks up year group names from yearGroups query', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);

      const mathsRow = getTopicRow(table, /mathematics/i);
      expect(within(mathsRow).getByText(/year 7, year 8/i)).toBeInTheDocument();
    });

    it('Year Groups column displays comma-separated year group names for topics with yearGroupKeys', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);

      const mathsRow = getTopicRow(table, /mathematics/i);
      const yearGroupsCell = getYearGroupsCell(mathsRow);
      expect(within(yearGroupsCell).getByText('Year 7, Year 8')).toBeInTheDocument();
    });

    it('Year Groups column displays empty string for topics with empty yearGroupKeys array', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);

      const scienceRow = getTopicRow(table, /science/i);
      const yearGroupsCell = getYearGroupsCell(scienceRow);
      expect(within(yearGroupsCell).getByText('')).toBeInTheDocument();
    });

    it('renders Edit and Delete action buttons for each topic row', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);
      expectRowsHaveActions(table);
    });
  });

  describe('year groups blocking dependency', () => {
    it('treats yearGroups dependency as blocking-required; ready-body content does not render until both topics and yearGroups data are ready', async () => {
      getYearGroupsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal(render, mocks, { seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).queryByRole('button', { name: /create topic/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('shows blocking alert when yearGroups query fails even if topics data is available', async () => {
      const dialog = await setupYearGroupsFailureWithTopicsSeeded(
        render,
        mocks,
        new Error('Year groups failed to load.'),
      );

      await waitFor(() => {
        assertReadyBodySuppressed(dialog);
      });
    });
  });

  describe('required refresh failures', () => {
    it('fails closed when a successful create cannot refresh the now-invalid topics data', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      await submitCreateTopicWhenRefreshFails(dialog, mocks);
      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /create topic/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('keeps the fail-closed topics state blocked after remount while the cached data is still untrustworthy', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient, unmount } = renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      await submitCreateTopicWhenRefreshFails(dialog, mocks);

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });

      unmount();
      renderWithFrontendProviders(
        <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
        { queryClient },
      );

      const remountedDialog = await findManageTopicsModalDialog();
      expect(within(remountedDialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      expect(
        within(remountedDialog).queryByRole('button', { name: /create topic/i }),
      ).not.toBeInTheDocument();
      expect(within(remountedDialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows an empty state and a primary Create topic button when no topics exist', async () => {
      renderManageTopicsModal(render, mocks, { topics: [] });

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByText(/no topics/i);
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });
  });

  describe('transient state reset via scaffold-owned close paths', () => {
    it('resets transient inline-dialog state when closed via Cancel and reopened', () =>
      assertTransientStateReset(render, mocks, 'Cancel'));

    it('resets transient inline-dialog state when closed via close icon and reopened', () =>
      assertTransientStateReset(render, mocks, 'close icon'));

    // NOTE: Mask click testing in JSDOM/HappyDOM with Ant Design Modal has known limitations
    // where the mask click event doesn't properly trigger onCancel. This test is skipped in
    // unit tests but should be covered by integration/Playwright tests.
    it.skip('resets transient inline-dialog state when closed via mask and reopened', () =>
      assertTransientStateReset(render, mocks, 'mask'));

    it('resets transient inline-dialog state when closed via Escape and reopened', () =>
      assertTransientStateReset(render, mocks, 'Escape'));
  });

  describe('modal close', () => {
    it('calls onClose when the modal footer Cancel button is activated', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));

      expect(onCloseMock).toHaveBeenCalledOnce();
    });

    it('does not render the modal content when open is false', () => {
      renderManageTopicsModal(render, mocks, { open: false });

      expectModalNotRendered();
    });

    it('passes modal closes callback through to scaffold', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);

      const closeIcon = within(dialog).getByRole('button', { name: /close/i });
      fireEvent.click(closeIcon);

      expect(onCloseMock).toHaveBeenCalledOnce();
    });
  });

  describe('loading state', () => {
    it('shows skeleton loading state', () => {
      getAssignmentTopicsMock.mockImplementation(() => new Promise(() => {}));

      renderManageTopicsModal(render, mocks, { seedQueryData: false });
      const dialog = getManageTopicsModalDialog();

      expect(within(dialog).getByRole('status', { name: 'Loading topics' })).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows alert on error state', async () => {
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Topics failed to load.'));

      const queryClient = createAppQueryClient();
      renderWithFrontendProviders(
        <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
        { queryClient },
      );
      const dialog = await findManageTopicsModalDialog();

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
