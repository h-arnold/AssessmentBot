/**
 * Manage Topics modal — refresh and load failure tests.
 *
 * Covers: fail-closed state after a required post-mutation refresh fails,
 * fail-closed persistence across remount while cached data is untrustworthy,
 * and the blocking load-error alert.
 */

import '@/test/referenceData/manageTopics.mockSetup';
import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import {
  createAssignmentTopicMock,
  createdTopicFixture,
  findManageTopicsModalDialog,
  getAssignmentTopicsMock,
  getYearGroupsMock,
  onCloseMock,
  onEntityCreatedMock,
  renderManageTopicsModal,
  seedTopics,
  seedYearGroups,
  submitCreateTopicWhenRefreshFails,
  topicsLoadFailureCopy,
} from '@/test/referenceData/manageTopicsTestHelpers';
import { ManageTopicsModal } from './ManageTopicsModal';

beforeEach(() => {
  vi.resetAllMocks();
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageTopicsModal', () => {
  describe('required refresh failures', () => {
    it('fails closed when a successful create cannot refresh the now-invalid topics data', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });
      expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
      expect(
        within(dialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
    });

    it('keeps the fail-closed topics state blocked after remount while the cached data is still untrustworthy', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient, unmount } = renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      });

      unmount();
      renderWithFrontendProviders(
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />,
        { queryClient }
      );

      const remountedDialog = await findManageTopicsModalDialog();
      expect(within(remountedDialog).getByRole('alert')).toHaveTextContent(topicsLoadFailureCopy);
      expect(
        within(remountedDialog).queryByRole('button', { name: /create topic/i })
      ).not.toBeInTheDocument();
      expect(
        within(remountedDialog).queryByRole('table', { name: /topics/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows alert on error state', async () => {
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Topics failed to load.'));

      const queryClient = createAppQueryClient();
      renderWithFrontendProviders(
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />,
        { queryClient }
      );
      const dialog = await findManageTopicsModalDialog();

      await waitFor(() => {
        expect(within(dialog).getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
