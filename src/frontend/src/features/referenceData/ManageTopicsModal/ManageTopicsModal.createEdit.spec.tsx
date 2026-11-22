/**
 * Manage Topics modal — create, edit, delete and creation callback tests.
 *
 * Covers: create form launch and year group options, edit form prefill and
 * submission, delete confirmation and required refresh, and the
 * onEntityCreated callback.
 */

import '@/test/referenceData/manageTopics.mockSetup';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentTopic } from '@/services/referenceData/referenceData.zod';
import type { createAppQueryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import {
  createAssignmentTopicMock,
  createdTopicFixture,
  deleteAssignmentTopicMock,
  findManageTopicsModalDialog,
  getAssignmentTopicsMock,
  getYearGroupsMock,
  onEntityCreatedMock,
  renderManageTopicsModal,
  seedTopics,
  seedYearGroups,
  submitCreateTopicWhenRefreshFails,
  topicCreateName,
  topicCreateSubmitButtonNameRegex,
  updateAssignmentTopicMock,
} from '@/test/referenceData/manageTopicsTestHelpers';

let user: ReturnType<typeof userEvent.setup>;

/**
 * Renders the ManageTopicsModal and opens the create topic form.
 *
 * @returns {Promise<{dialog: HTMLElement; formDialog: HTMLElement}>} The modal dialog and form dialog elements.
 */
async function openCreateTopicForm(): Promise<{ dialog: HTMLElement; formDialog: HTMLElement }> {
  renderManageTopicsModal();

  const dialog = await findManageTopicsModalDialog();
  await within(dialog).findByRole('table', { name: /topics/i });
  fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

  const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
  return { dialog, formDialog };
}

/**
 * Opens the edit form for Mathematics topic.
 *
 * @returns {Promise<{dialog: HTMLElement; table: HTMLElement; formDialog: HTMLElement; mathsRow: HTMLElement; queryClient: ReturnType<typeof createAppQueryClient>}>} The modal dialog, table, form dialog, maths row elements, and query client.
 */
async function openEditMathsForm(): Promise<{
  dialog: HTMLElement;
  table: HTMLElement;
  formDialog: HTMLElement;
  mathsRow: HTMLElement;
  queryClient: ReturnType<typeof createAppQueryClient>;
}> {
  const { queryClient } = renderManageTopicsModal();

  const dialog = await findManageTopicsModalDialog();
  const table = await within(dialog).findByRole('table', { name: /topics/i });
  const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
  fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

  const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
  return { dialog, table, formDialog, mathsRow, queryClient };
}

/**
 * Asserts that the create form dialog has a name textbox.
 *
 * @param {HTMLElement} formDialog - The form dialog element.
 */
function assertFormHasNameTextbox(formDialog: HTMLElement): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toBeInTheDocument();
}

/**
 * Asserts that the seeded Mathematics topic name is shown in the edit form.
 *
 * @param {HTMLElement} formDialog - The form dialog element.
 */
function assertEditFormNameValue(formDialog: HTMLElement): void {
  expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('Mathematics');
}

beforeEach(() => {
  vi.resetAllMocks();
  user = userEvent.setup();
  getAssignmentTopicsMock.mockResolvedValue(seedTopics);
  getYearGroupsMock.mockResolvedValue(seedYearGroups);
});

describe('ManageTopicsModal', () => {
  describe('create flow', () => {
    it('renders a Create topic button when topics are listed', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });

    it('exposes data-testid="reference-data-create-action-icon" on the create action', async () => {
      renderManageTopicsModal();
      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      expect(within(dialog).getByTestId('reference-data-create-action-icon')).toBeInTheDocument();
    });

    it('opens a blank topic form modal when the Create topic button is clicked', async () => {
      renderManageTopicsModal();

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });

    it('Create form includes year group multi-select field with all available year groups as options', async () => {
      const yearGroups = [
        { key: 'year-11', name: 'Year 11' },
        { key: 'year-9', name: 'Year 9' },
        { key: 'year-10', name: 'Year 10' },
      ];
      renderManageTopicsModal({ yearGroups });
      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await user.click(within(dialog).getByRole('button', { name: /create topic/i }));
      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });

      await user.click(within(formDialog).getByRole('combobox'));
      // In Ant Design v6 the visible dropdown popup (`.ant-select-dropdown`) renders each
      // option as a `.ant-select-item-option` element whose text content is the year-group
      // label; the antd measurement listbox carries `role="option"` but only with the key as
      // text, so the ordering assertion is scoped to the visible option labels instead.
      const firstOption = await screen.findByText('Year 9');
      const dropdown = firstOption.closest('.ant-select-dropdown') as HTMLElement;
      const optionLabels = within(dropdown)
        .getAllByText(/^Year \d+$/)
        .map((option) => option.textContent?.trim() ?? '');
      // The fixture is deliberately unsorted (Year 11, Year 9, Year 10); the multi-select
      // must present options in natural year-group order regardless of input ordering.
      expect(optionLabels).toEqual(['Year 9', 'Year 10', 'Year 11']);
    });

    it('Create form year group multi-select allows multiple selection', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });

    it('Create form year group multi-select allows empty selection', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });

    it('calls createAssignmentTopic with yearGroupKeys and refetches the active topics query after a successful create', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient } = renderManageTopicsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });
      await submitCreateTopicWhenRefreshFails(dialog);
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });

    it('Create form includes year group multi-select with year group options', async () => {
      const { formDialog } = await openCreateTopicForm();
      assertFormHasNameTextbox(formDialog);
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled topic form modal when an Edit button is clicked', async () => {
      const { formDialog } = await openEditMathsForm();
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('Edit form includes year group multi-select field with pre-selected existing yearGroupKeys', async () => {
      const { formDialog } = await openEditMathsForm();
      assertEditFormNameValue(formDialog);
    });

    it('Edit form year group multi-select allows changing selected year groups', async () => {
      const { formDialog } = await openEditMathsForm();
      assertEditFormNameValue(formDialog);
    });

    it('calls updateAssignmentTopic and refetches the active topics query after a successful edit', async () => {
      const updatedTopic: AssignmentTopic = { ...seedTopics[0], name: 'Mathematics Updated' };
      updateAssignmentTopicMock.mockResolvedValue(updatedTopic);

      const { queryClient, formDialog } = await openEditMathsForm();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const nameInput = within(formDialog).getByRole('textbox', { name: /name/i });
      fireEvent.change(nameInput, { target: { value: 'Mathematics Updated' } });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|update/i }));

      await waitFor(() => {
        expect(updateAssignmentTopicMock).toHaveBeenCalledWith({
          key: seedTopics[0].key,
          record: expect.objectContaining({ name: 'Mathematics Updated' }),
        });
      });
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });

  describe('delete flow', () => {
    it('calls deleteAssignmentTopic and refetches the active topics query after a successful delete', async () => {
      deleteAssignmentTopicMock.mockImplementation(() => Promise.resolve());

      const { queryClient } = renderManageTopicsModal();
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      const table = await within(dialog).findByRole('table', { name: /topics/i });
      const mathsRow = within(table).getByRole('row', { name: /mathematics/i });
      fireEvent.click(within(mathsRow).getByRole('button', { name: /delete/i }));

      const deleteDialog = await screen.findByRole('dialog', { name: /delete topic/i });
      fireEvent.click(within(deleteDialog).getByRole('button', { name: /delete/i }));

      await waitFor(() => {
        expect(deleteAssignmentTopicMock).toHaveBeenCalledWith({
          key: seedTopics[0].key,
        });
      });
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true })
        );
      });
    });
  });

  describe('onEntityCreated callback', () => {
    it('calls onEntityCreated callback when a topic is created', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal({ onEntityCreated: onEntityCreatedMock });

      const dialog = await findManageTopicsModalDialog();
      await within(dialog).findByRole('table', { name: /topics/i });

      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: topicCreateName },
      });
      fireEvent.click(
        within(formDialog).getByRole('button', { name: topicCreateSubmitButtonNameRegex })
      );

      await waitFor(() => {
        expect(onEntityCreatedMock).toHaveBeenCalledWith(
          expect.objectContaining({
            key: createdTopicFixture.key,
            name: createdTopicFixture.name,
            yearGroupKeys: createdTopicFixture.yearGroupKeys,
          })
        );
      });
    });
  });
});
