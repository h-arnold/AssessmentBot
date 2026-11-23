/**
 * Shared fixtures and render helpers for the ManageTopicsModal specs.
 *
 * The three topics suites render the real modal against seeded React Query
 * caches. Keep the fixture values, dialog queries and close-path harness here
 * so each suite configures only its own scenarios.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { expect, vi } from 'vitest';
import type { AssignmentTopic, YearGroup } from '@/services/referenceData/referenceData.zod';
import { queryKeys } from '@/query/queryKeys';
import { createAppQueryClient } from '@/query/queryClient';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { StartupWarmupStateProvider } from '@/features/auth/startupWarmupState';
import { ManageTopicsModal } from '@/features/referenceData/ManageTopicsModal/ManageTopicsModal';
import { getAssignmentTopics } from '@/services/assignmentDefinition/assignmentTopicsService';
import {
  createAssignmentTopic,
  deleteAssignmentTopic,
  getYearGroups,
  updateAssignmentTopic,
} from '@/services/referenceData/referenceDataService';

export const getAssignmentTopicsMock = vi.mocked(getAssignmentTopics);
export const getYearGroupsMock = vi.mocked(getYearGroups);
export const createAssignmentTopicMock = vi.mocked(createAssignmentTopic);
export const updateAssignmentTopicMock = vi.mocked(updateAssignmentTopic);
export const deleteAssignmentTopicMock = vi.mocked(deleteAssignmentTopic);

export const onCloseMock = vi.fn<() => void>();
export const onEntityCreatedMock = vi.fn<(entity: AssignmentTopic) => void>();

export const topicsLoadFailureCopy = 'Unable to load topics right now.';

// Timeout constants for async test operations
const MODAL_CLOSE_TIMEOUT_MS = 100;

export const seedYearGroups: YearGroup[] = [
  { key: 'year-7', name: 'Year 7' },
  { key: 'year-8', name: 'Year 8' },
  { key: 'year-9', name: 'Year 9' },
];

export const seedTopics: AssignmentTopic[] = [
  {
    key: 'topic-maths',
    name: 'Mathematics',
    yearGroupKeys: ['year-7', 'year-8'],
  },
  {
    key: 'topic-english',
    name: 'English',
    yearGroupKeys: ['year-7'],
  },
  {
    key: 'topic-science',
    name: 'Science',
    yearGroupKeys: [],
  },
];

export const topicCreateName = 'History';
const createTopicInputNameRegex = /name/i;
export const topicCreateSubmitButtonNameRegex = /ok|save|create/i;
const topicCreateDialogNameRegex = /create topic/i;
const refreshFailedErrorMessage = 'Refresh failed.';
export const createdTopicFixture: AssignmentTopic = {
  key: 'topic-history',
  name: topicCreateName,
  yearGroupKeys: ['year-8', 'year-9'],
};

/**
 * Render options for ManageTopicsModal tests.
 */
type RenderOptions = {
  open?: boolean;
  topics?: AssignmentTopic[];
  yearGroups?: YearGroup[];
  seedQueryData?: boolean;
  onEntityCreated?: (entity: AssignmentTopic) => void;
};

/**
 * Setup query client with seeded data for testing.
 *
 * @param {AssignmentTopic[]} topics Topics data to seed.
 * @param {YearGroup[]} yearGroups Year groups data to seed.
 * @param {boolean} shouldSeedQueryData Whether to seed query data.
 * @returns {ReturnType<typeof createAppQueryClient>} Configured query client.
 */
function setupTestQueryClient(
  topics: AssignmentTopic[],
  yearGroups: YearGroup[],
  shouldSeedQueryData: boolean
): ReturnType<typeof createAppQueryClient> {
  const queryClient = createAppQueryClient();
  if (shouldSeedQueryData) {
    queryClient.setQueryData(queryKeys.assignmentTopics(), topics);
    queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  }
  return queryClient;
}

/**
 * Renders ManageTopicsModal with pre-seeded data and optional overrides.
 *
 * @param {RenderOptions} [options] Render options.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
export function renderManageTopicsModal(
  options: RenderOptions = {}
): ReturnType<typeof renderWithFrontendProviders> {
  const isOpen = options.open ?? true;
  const topics = options.topics ?? seedTopics;
  const yearGroups = options.yearGroups ?? seedYearGroups;
  const shouldSeedQueryData = options.seedQueryData ?? true;
  const onEntityCreated = options.onEntityCreated ?? onEntityCreatedMock;
  const queryClient = setupTestQueryClient(topics, yearGroups, shouldSeedQueryData);

  getAssignmentTopicsMock.mockResolvedValue(topics);
  getYearGroupsMock.mockResolvedValue(yearGroups);

  return renderWithFrontendProviders(
    <ManageTopicsModal open={isOpen} onClose={onCloseMock} onEntityCreated={onEntityCreated} />,
    { queryClient }
  );
}

/**
 * Returns the owned Manage Topics modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Topics dialog.
 */
export function getManageTopicsModalDialog() {
  return screen.getByRole('dialog', { name: /manage topics/i });
}

/**
 * Finds the owned Manage Topics modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Topics dialog.
 */
export function findManageTopicsModalDialog() {
  return screen.findByRole('dialog', { name: /manage topics/i });
}

/**
 * Opens and submits the Create topic dialog while forcing refresh failure.
 *
 * @param {HTMLElement} dialog The outer Manage Topics modal dialog.
 * @returns {Promise<void>} Resolves once create submission has been asserted.
 */
export async function submitCreateTopicWhenRefreshFails(dialog: HTMLElement) {
  getAssignmentTopicsMock.mockRejectedValueOnce(new Error(refreshFailedErrorMessage));
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: topicCreateDialogNameRegex });
  fireEvent.change(within(formDialog).getByRole('textbox', { name: createTopicInputNameRegex }), {
    target: { value: topicCreateName },
  });
  fireEvent.click(
    within(formDialog).getByRole('button', { name: topicCreateSubmitButtonNameRegex })
  );

  await waitFor(() => {
    expect(createAssignmentTopicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ name: topicCreateName }),
      })
    );
  });
}

/**
 * Asserts that the ready modal body is suppressed (no create button, no table, alert visible).
 *
 * @param {HTMLElement} dialog - The modal dialog element.
 * @param {string} [alertText] - Optional specific alert text to check.
 */
export function assertReadyBodySuppressed(dialog: HTMLElement, alertText?: string): void {
  expect(within(dialog).queryByRole('button', { name: /create topic/i })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('table', { name: /topics/i })).not.toBeInTheDocument();
  const alert = within(dialog).getByRole('alert');
  expect(alert).toBeInTheDocument();
  if (alertText) {
    expect(alert).toHaveTextContent(alertText);
  }
}

/**
 * Closes the modal via the Cancel button in the footer.
 */
function closeViaCancel() {
  const footerCancel = screen
    .getAllByRole('button', { name: /cancel/i })
    .find((button) => button.closest('.ant-modal-footer') !== null);
  if (!footerCancel) throw new Error('Cancel button not found in footer');
  fireEvent.click(footerCancel);
}

/**
 * Closes the modal via the close icon.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
function closeViaIcon(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
}

/**
 * Closes the modal via mask (backdrop) click.
 *
 * antd v6 delegates modal mask handling to @rc-component/dialog, which uses a
 * mousedown-then-mouseup pair on the .ant-modal-wrap element — not the
 * .ant-modal-mask sibling. Because the modal renders in a React portal, React
 * Testing Library's fireEvent does not reliably trigger React synthetic event
 * handlers on portal-mounted elements. The safe pattern is native dispatchEvent.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
async function closeViaMask(dialog: HTMLElement) {
  const wrap = dialog.closest('.ant-modal-wrap');
  if (!wrap) {
    throw new Error('Modal wrap not found');
  }

  await act(() => {
    wrap.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  // Wait for modal close to complete - Ant Design modal close can be async in test environments
  await new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_TIMEOUT_MS));
}

/**
 * Closes the modal via Escape key.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
function closeViaEscape(dialog: HTMLElement) {
  fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
}

/**
 * Closes the modal via the specified method.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} closeMethod Close action to perform.
 */
async function closeModal(
  dialog: HTMLElement,
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape'
) {
  switch (closeMethod) {
    case 'Cancel': {
      closeViaCancel();
      break;
    }
    case 'close icon': {
      closeViaIcon(dialog);
      break;
    }
    case 'mask': {
      await closeViaMask(dialog);
      break;
    }
    case 'Escape': {
      closeViaEscape(dialog);
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
 * @param {'Cancel' | 'close icon' | 'mask' | 'Escape'} closeMethod How to close the modal.
 * @returns {Promise<void>}
 */
export async function assertTransientStateReset(
  closeMethod: 'Cancel' | 'close icon' | 'mask' | 'Escape'
): Promise<void> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  queryClient.setQueryData(queryKeys.yearGroups(), seedYearGroups);
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);

  const { rerender } = renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );

  const dialog = await screen.findByRole('dialog', { name: /manage topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));
  await screen.findByRole('dialog', { name: /create topic/i });

  await closeModal(dialog, closeMethod);
  expect(onCloseMock).toHaveBeenCalledOnce();

  onCloseMock.mockClear();
  rerender(
    <QueryClientProvider client={queryClient}>
      <StartupWarmupStateProvider warmupState="ready">
        <ManageTopicsModal
          open={true}
          onClose={onCloseMock}
          onEntityCreated={onEntityCreatedMock}
        />
      </StartupWarmupStateProvider>
    </QueryClientProvider>
  );
  const reopenedDialog = await screen.findByRole('dialog', { name: /manage topics/i });

  await within(reopenedDialog).findByRole('table', { name: /topics/i });
  expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
}

/**
 * Sets up a test scenario where a query fails before any usable data loads.
 *
 * @param {'topics' | 'yearGroups'} queryType - Which query to fail.
 * @param {Error} error - The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
export function setupQueryFailureBeforeDataLoad(
  queryType: 'topics' | 'yearGroups',
  error: Error
): Promise<HTMLElement> {
  if (queryType === 'topics') {
    getAssignmentTopicsMock.mockRejectedValueOnce(error);
  } else {
    getYearGroupsMock.mockRejectedValueOnce(error);
  }

  const queryClient = createAppQueryClient();
  renderWithFrontendProviders(
    <ManageTopicsModal open={true} onClose={onCloseMock} onEntityCreated={onEntityCreatedMock} />,
    { queryClient }
  );
  return findManageTopicsModalDialog();
}
