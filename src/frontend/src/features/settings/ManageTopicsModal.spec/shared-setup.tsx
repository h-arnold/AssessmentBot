/**
 * Shared setup, seed data, and helper functions for ManageTopicsModal tests.
 *
 * This module CANNOT import from `../../test/` (ESLint restriction) and MUST NOT
 * use vi.hoisted() / vi.mock() / beforeEach / afterEach — those belong in spec files.
 *
 * Functions that need rendering or mock access receive them as parameters from the
 * calling spec file so that the ESLint no-restricted-imports rule is satisfied.
 */

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { Mock } from 'vitest';
import type { AssignmentTopic, YearGroup } from '../../../services/referenceData.zod';
import { queryKeys } from '../../../query/queryKeys';
import { createAppQueryClient } from '../../../query/queryClient';
import { StartupWarmupStateProvider } from '../../auth/startupWarmupState';
import { ManageTopicsModal } from '../ManageTopicsModal';

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

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

export const createdTopicFixture: AssignmentTopic = {
  key: 'topic-history',
  name: 'History',
  yearGroupKeys: ['year-8', 'year-9'],
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const topicsLoadFailureCopy = 'Unable to load topics right now.';
export const MODAL_CLOSE_TIMEOUT_MS = 100;
export const topicCreateName = 'History';
export const createTopicInputNameRegex = /name/i;
export const topicCreateSubmitButtonNameRegex = /ok|save|create/i;
export const topicCreateDialogNameRegex = /create topic/i;
export const refreshFailedErrorMessage = 'Refresh failed.';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal render function signature matching {@link renderWithFrontendProviders}
 * so shared-setup doesn't need to import from `src/test`.
 */
export type RenderFunction = (
  ui: ReactElement,
  options?: { queryClient?: QueryClient },
) => { queryClient: QueryClient; rerender: (ui: ReactElement) => void; unmount: () => void };

/**
 * All mock objects that shared helpers may need to wire up or assert against.
 */
export interface ManageTopicsMocks {
  getAssignmentTopicsMock: Mock;
  getYearGroupsMock: Mock;
  onCloseMock: Mock;
  onEntityCreatedMock: Mock;
  createAssignmentTopicMock: Mock;
  updateAssignmentTopicMock: Mock;
  deleteAssignmentTopicMock: Mock;
}

export interface RenderOptions {
  open?: boolean;
  topics?: AssignmentTopic[];
  yearGroups?: YearGroup[];
  seedQueryData?: boolean;
  onEntityCreated?: (entity: AssignmentTopic) => void;
}

/** Supported modal close methods for test scenarios. */
export type CloseMethod = 'Cancel' | 'close icon' | 'mask' | 'Escape';

/** Subset of mocks needed for modal rendering and standard interactions. */
export type ManageTopicsRenderMocks = Pick<
  ManageTopicsMocks,
  'getAssignmentTopicsMock' | 'getYearGroupsMock' | 'onCloseMock' | 'onEntityCreatedMock'
>;

// ---------------------------------------------------------------------------
// Query client helper
// ---------------------------------------------------------------------------

/**
 * Setup query client with seeded data for testing.
 *
 * @param {AssignmentTopic[]} topics Topics data to seed.
 * @param {YearGroup[]} yearGroups Year groups data to seed.
 * @param {boolean} seedQueryData Whether to seed query data.
 * @returns {QueryClient} Configured query client.
 */
export function setupTestQueryClient(
  topics: AssignmentTopic[],
  yearGroups: YearGroup[],
  seedQueryData: boolean,
): QueryClient {
  const queryClient = createAppQueryClient();
  if (seedQueryData) {
    queryClient.setQueryData(queryKeys.assignmentTopics(), topics);
    queryClient.setQueryData(queryKeys.yearGroups(), yearGroups);
  }
  return queryClient;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

/**
 * Renders ManageTopicsModal with pre-seeded data and optional overrides.
 *
 * @param {RenderFunction} render The render function (renderWithFrontendProviders from the spec file).
 * @param {ManageTopicsRenderMocks} mocks Mock objects to wire up.
 * @param {RenderOptions} [options] Render options.
 * @returns {{ queryClient: QueryClient; rerender: (ui: ReactElement) => void; unmount: () => void }} Render result and query client.
 */
export function renderManageTopicsModal(
  render: RenderFunction,
  mocks: ManageTopicsRenderMocks,
  options: RenderOptions = {},
) {
  const open = options.open ?? true;
  const topics = options.topics ?? seedTopics;
  const yearGroups = options.yearGroups ?? seedYearGroups;
  const seedQueryData = options.seedQueryData ?? true;
  const onEntityCreated = options.onEntityCreated ?? mocks.onEntityCreatedMock;
  const queryClient = setupTestQueryClient(topics, yearGroups, seedQueryData);

  mocks.getAssignmentTopicsMock.mockResolvedValue(topics);
  mocks.getYearGroupsMock.mockResolvedValue(yearGroups);

  return render(
    <ManageTopicsModal open={open} onClose={mocks.onCloseMock} onEntityCreated={onEntityCreated} />,
    { queryClient },
  );
}

// ---------------------------------------------------------------------------
// Dialog query helpers (no mocks needed)
// ---------------------------------------------------------------------------

/**
 * Returns the owned Manage Topics modal dialog region.
 *
 * @returns {HTMLElement} The outer Manage Topics dialog.
 */
export function getManageTopicsModalDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: /manage topics/i });
}

/**
 * Finds the owned Manage Topics modal dialog region.
 *
 * @returns {Promise<HTMLElement>} The outer Manage Topics dialog.
 */
export function findManageTopicsModalDialog(): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: /manage topics/i });
}

// ---------------------------------------------------------------------------
// Close helpers (no mocks needed)
// ---------------------------------------------------------------------------

/**
 * Closes the modal via the Cancel button in the footer.
 */
export function closeViaCancel(): void {
  const footerCancel = screen.getAllByRole('button', { name: /cancel/i }).find(
    (button) => button.closest('.ant-modal-footer') !== null,
  );
  if (!footerCancel) throw new Error('Cancel button not found in footer');
  fireEvent.click(footerCancel);
}

/**
 * Closes the modal via the close icon.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
export function closeViaIcon(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
}

/**
 * Closes the modal via mask click.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
export async function closeViaMask(dialog: HTMLElement): Promise<void> {
  // Find the wrap for this modal
  const wrap = dialog.closest('.ant-modal-wrap');
  if (!wrap) {
    throw new Error('Modal wrap not found');
  }

  // In Ant Design, the mask is a sibling before the wrap
  const mask = wrap?.previousElementSibling;
  if (mask?.classList.contains('ant-modal-mask')) {
    await act(async () => {
      fireEvent.click(mask);
    });
    // Wait for modal close to complete - Ant Design modal close can be async in test environments
    await new Promise((resolve) => setTimeout(resolve, MODAL_CLOSE_TIMEOUT_MS));
    return;
  }

  throw new Error('Mask not found');
}

/**
 * Closes the modal via Escape key.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 */
export function closeViaEscape(dialog: HTMLElement): void {
  fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });
}

/**
 * Closes the modal via the specified method.
 *
 * @param {HTMLElement} dialog Modal dialog element.
 * @param {CloseMethod} closeMethod Close action to perform.
 */
export async function closeModal(dialog: HTMLElement, closeMethod: CloseMethod): Promise<void> {
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

// ---------------------------------------------------------------------------
// Modal close + reopen — transient state reset
// ---------------------------------------------------------------------------

/**
 * Tests that transient inline-dialog state is reset when modal closes and reopens.
 *
 * @param {RenderFunction} render The render function.
 * @param {ManageTopicsMocks} mocks Mock objects.
 * @param {CloseMethod} closeMethod How to close the modal.
 */
export async function assertTransientStateReset(
  render: RenderFunction,
  mocks: ManageTopicsMocks,
  closeMethod: CloseMethod,
): Promise<void> {
  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  queryClient.setQueryData(queryKeys.yearGroups(), seedYearGroups);
  mocks.getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  mocks.getYearGroupsMock.mockResolvedValue(seedYearGroups);

  const { rerender } = render(
    <ManageTopicsModal open={true} onClose={mocks.onCloseMock} onEntityCreated={mocks.onEntityCreatedMock} />,
    { queryClient },
  );

  const dialog = await screen.findByRole('dialog', { name: /manage topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));
  await screen.findByRole('dialog', { name: /create topic/i });

  await closeModal(dialog, closeMethod);
  expect(mocks.onCloseMock).toHaveBeenCalledOnce();

  mocks.onCloseMock.mockClear();
  rerender(
    <QueryClientProvider client={queryClient}>
      <StartupWarmupStateProvider warmupState="ready">
        <ManageTopicsModal open={true} onClose={mocks.onCloseMock} onEntityCreated={mocks.onEntityCreatedMock} />
      </StartupWarmupStateProvider>
    </QueryClientProvider>,
  );
  const reopenedDialog = await screen.findByRole('dialog', { name: /manage topics/i });

  await within(reopenedDialog).findByRole('table', { name: /topics/i });
  expect(screen.queryByRole('dialog', { name: /create topic/i })).not.toBeInTheDocument();
}

// ---------------------------------------------------------------------------
// Open form helpers
// ---------------------------------------------------------------------------

/**
 * Renders the ManageTopicsModal and opens the create topic form.
 *
 * @param {RenderFunction} render The render function.
 * @param {ManageTopicsRenderMocks} mocks Mock objects.
 * @returns {Promise<{ dialog: HTMLElement; formDialog: HTMLElement }>} The modal dialog and form dialog elements.
 */
export async function openCreateTopicForm(
  render: RenderFunction,
  mocks: ManageTopicsRenderMocks,
): Promise<{ dialog: HTMLElement; formDialog: HTMLElement }> {
  renderManageTopicsModal(render, mocks);

  const dialog = await findManageTopicsModalDialog();
  await within(dialog).findByRole('table', { name: /topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
  return { dialog, formDialog };
}

/**
 * Opens the edit form for Mathematics topic.
 *
 * @param {RenderFunction} render The render function.
 * @param {ManageTopicsRenderMocks} mocks Mock objects.
 * @returns {Promise<{ dialog: HTMLElement; table: HTMLElement; formDialog: HTMLElement; mathsRow: HTMLElement; queryClient: QueryClient }>} The modal dialog, table, form dialog, maths row elements, and query client.
 */
export async function openEditMathsForm(
  render: RenderFunction,
  mocks: ManageTopicsRenderMocks,
): Promise<{
  dialog: HTMLElement;
  table: HTMLElement;
  formDialog: HTMLElement;
  mathsRow: HTMLElement;
  queryClient: QueryClient;
}> {
  const { queryClient } = renderManageTopicsModal(render, mocks);

  const dialog = await findManageTopicsModalDialog();
  const table = await within(dialog).findByRole('table', { name: /topics/i });
  const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
  fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

  const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
  return { dialog, table, formDialog, mathsRow, queryClient };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Asserts that the ready modal body is suppressed (no create button, no table, alert visible).
 *
 * @param {HTMLElement} dialog The modal dialog element.
 * @param {string} [alertText] Optional specific alert text to check.
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
 * Asserts that the create form dialog has a name textbox.
 *
 * @param {HTMLElement} formDialog The form dialog element.
 */
export function assertFormHasNameTextbox(formDialog: HTMLElement): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toBeInTheDocument();
}

/**
 * Asserts that the edit form dialog has a name textbox with a specific value.
 *
 * @param {HTMLElement} formDialog The form dialog element.
 * @param {string} expectedValue The expected value of the name textbox.
 */
export function assertEditFormNameValue(formDialog: HTMLElement, expectedValue: string): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue(expectedValue);
}

// ---------------------------------------------------------------------------
// Query failure setup helpers
// ---------------------------------------------------------------------------

/**
 * Sets up a test scenario where a query fails before any usable data loads.
 *
 * @param {RenderFunction} render The render function.
 * @param {ManageTopicsRenderMocks} mocks Mock objects.
 * @param {'topics' | 'yearGroups'} queryType Which query to fail.
 * @param {Error} error The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
export async function setupQueryFailureBeforeDataLoad(
  render: RenderFunction,
  mocks: ManageTopicsRenderMocks,
  queryType: 'topics' | 'yearGroups',
  error: Error,
): Promise<HTMLElement> {
  if (queryType === 'topics') {
    mocks.getAssignmentTopicsMock.mockRejectedValueOnce(error);
  } else {
    mocks.getYearGroupsMock.mockRejectedValueOnce(error);
  }

  const queryClient = createAppQueryClient();
  render(
    <ManageTopicsModal open={true} onClose={mocks.onCloseMock} onEntityCreated={mocks.onEntityCreatedMock} />,
    { queryClient },
  );
  return findManageTopicsModalDialog();
}

/**
 * Sets up a test scenario where yearGroups query fails but topics data is already seeded.
 *
 * @param {RenderFunction} render The render function.
 * @param {ManageTopicsRenderMocks} mocks Mock objects.
 * @param {Error} error The error to reject with.
 * @returns {Promise<HTMLElement>} The modal dialog element.
 */
export async function setupYearGroupsFailureWithTopicsSeeded(
  render: RenderFunction,
  mocks: ManageTopicsRenderMocks,
  error: Error,
): Promise<HTMLElement> {
  mocks.getYearGroupsMock.mockRejectedValueOnce(error);

  const queryClient = createAppQueryClient();
  queryClient.setQueryData(queryKeys.assignmentTopics(), seedTopics);
  mocks.getAssignmentTopicsMock.mockResolvedValue(seedTopics);

  render(
    <ManageTopicsModal open={true} onClose={mocks.onCloseMock} onEntityCreated={mocks.onEntityCreatedMock} />,
    { queryClient },
  );
  return findManageTopicsModalDialog();
}

// ---------------------------------------------------------------------------
// Create/refresh failure helper
// ---------------------------------------------------------------------------

/**
 * Opens and submits the Create topic dialog while forcing refresh failure.
 *
 * @param {HTMLElement} dialog The outer Manage Topics modal dialog.
 * @param {Pick<ManageTopicsMocks, 'getAssignmentTopicsMock' | 'createAssignmentTopicMock'>} mocks Mock objects needed for the operation.
 */
export async function submitCreateTopicWhenRefreshFails(
  dialog: HTMLElement,
  mocks: Pick<ManageTopicsMocks, 'getAssignmentTopicsMock' | 'createAssignmentTopicMock'>,
): Promise<void> {
  mocks.getAssignmentTopicsMock.mockRejectedValueOnce(new Error(refreshFailedErrorMessage));
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: topicCreateDialogNameRegex });
  fireEvent.change(within(formDialog).getByRole('textbox', { name: createTopicInputNameRegex }), {
    target: { value: topicCreateName },
  });
  fireEvent.click(within(formDialog).getByRole('button', { name: topicCreateSubmitButtonNameRegex }));

  await waitFor(() => {
    expect(mocks.createAssignmentTopicMock).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ name: topicCreateName }),
      }),
    );
  });
}


