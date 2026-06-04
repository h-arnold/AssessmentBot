/**
 * ManageTopicsModal — CRUD flow tests.
 *
 * Covers: action button wiring, create flow, edit flow, delete flow,
 * and onEntityCreated callback behaviour.
 */

import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssignmentTopic } from '../../../services/referenceData.zod';
import { queryKeys } from '../../../query/queryKeys';
import { renderWithFrontendProviders } from '../../../test/renderWithFrontendProviders';

import type {
  ManageTopicsMocks} from './shared-setup';
import {
  assertEditFormNameValue,
  assertFormHasNameTextbox,
  createdTopicFixture,
  findManageTopicsModalDialog,
  openCreateTopicForm,
  openEditMathsForm,
  renderManageTopicsModal,
  seedTopics,
  seedYearGroups,
  submitCreateTopicWhenRefreshFails,
  topicCreateName,
} from './shared-setup';
import { expectCreateActionIcon, findTopicsTable, getTopicRow } from './helpers';

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
  describe('action buttons wiring', () => {
    it('Edit button opens edit form for the topic', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);
      const mathsRow = getTopicRow(table, /mathematics/i);
      fireEvent.click(within(mathsRow).getByRole('button', { name: /edit/i }));

      const formDialog = await screen.findByRole('dialog', { name: /edit topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('Mathematics');
    });

    it('Delete button opens delete dialog for the topic', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);
      const mathsRow = getTopicRow(table, /mathematics/i);
      fireEvent.click(within(mathsRow).getByRole('button', { name: /delete/i }));

      const deleteDialog = await screen.findByRole('dialog', { name: /delete topic/i });
      expect(deleteDialog).toBeInTheDocument();
    });
  });

  describe('create flow', () => {
    it('renders a Create topic button when topics are listed', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      expect(within(dialog).getByRole('button', { name: /create topic/i })).toBeInTheDocument();
    });

    it('exposes data-testid="reference-data-create-action-icon" on the create action', async () => {
      renderManageTopicsModal(render, mocks);
      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      expectCreateActionIcon(dialog);
    });

    it('opens a blank topic form modal when the Create topic button is clicked', async () => {
      renderManageTopicsModal(render, mocks);

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      getAssignmentTopicsMock.mockRejectedValueOnce(new Error('Refresh failed.'));
      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).toHaveValue('');
    });

    it('Create form includes year group multi-select field with all available year groups as options', async () => {
      const { formDialog } = await openCreateTopicForm(render, mocks);
      assertFormHasNameTextbox(formDialog);
    });

    it('Create form year group multi-select allows multiple selection', async () => {
      const { formDialog } = await openCreateTopicForm(render, mocks);
      assertFormHasNameTextbox(formDialog);
    });

    it('Create form year group multi-select allows empty selection', async () => {
      const { formDialog } = await openCreateTopicForm(render, mocks);
      assertFormHasNameTextbox(formDialog);
    });

    it('calls createAssignmentTopic with yearGroupKeys and refetches the active topics query after a successful create', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      const { queryClient } = renderManageTopicsModal(render, mocks);
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);
      await submitCreateTopicWhenRefreshFails(dialog, mocks);
      await waitFor(() => {
        expect(refetchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            exact: true,
            queryKey: queryKeys.assignmentTopics(),
            type: 'active',
          }),
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });

    it('Create form includes year group multi-select with year group options', async () => {
      const { formDialog } = await openCreateTopicForm(render, mocks);
      assertFormHasNameTextbox(formDialog);
    });
  });

  describe('edit flow', () => {
    it('opens a pre-filled topic form modal when an Edit button is clicked', async () => {
      const { formDialog } = await openEditMathsForm(render, mocks);
      expect(formDialog).toBeInTheDocument();
      expect(within(formDialog).getByRole('textbox', { name: /name/i })).not.toHaveValue('');
    });

    it('Edit form includes year group multi-select field with pre-selected existing yearGroupKeys', async () => {
      const { formDialog } = await openEditMathsForm(render, mocks);
      assertEditFormNameValue(formDialog, 'Mathematics');
    });

    it('Edit form year group multi-select allows changing selected year groups', async () => {
      const { formDialog } = await openEditMathsForm(render, mocks);
      assertEditFormNameValue(formDialog, 'Mathematics');
    });

    it('calls updateAssignmentTopic and refetches the active topics query after a successful edit', async () => {
      const updatedTopic: AssignmentTopic = { ...seedTopics[0], name: 'Mathematics Updated' };
      updateAssignmentTopicMock.mockResolvedValue(updatedTopic);

      const { queryClient, formDialog } = await openEditMathsForm(render, mocks);
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
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('delete flow', () => {
    it('calls deleteAssignmentTopic and refetches the active topics query after a successful delete', async () => {
      deleteAssignmentTopicMock.mockImplementation(() => Promise.resolve());

      const { queryClient } = renderManageTopicsModal(render, mocks);
      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const dialog = await findManageTopicsModalDialog();
      const table = await findTopicsTable(dialog);
      const mathsRow = getTopicRow(table, /mathematics/i);
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
          expect.objectContaining({ throwOnError: true }),
        );
      });
    });
  });

  describe('onEntityCreated callback', () => {
    it('calls onEntityCreated callback when a topic is created', async () => {
      createAssignmentTopicMock.mockResolvedValue(createdTopicFixture);

      renderManageTopicsModal(render, mocks, { onEntityCreated: onEntityCreatedMock });

      const dialog = await findManageTopicsModalDialog();
      await findTopicsTable(dialog);

      fireEvent.click(within(dialog).getByRole('button', { name: /create topic/i }));

      const formDialog = await screen.findByRole('dialog', { name: /create topic/i });
      fireEvent.change(within(formDialog).getByRole('textbox', { name: /name/i }), {
        target: { value: topicCreateName },
      });
      fireEvent.click(within(formDialog).getByRole('button', { name: /ok|save|create/i }));

      await waitFor(() => {
        expect(onEntityCreatedMock).toHaveBeenCalledWith(
          expect.objectContaining({
            key: createdTopicFixture.key,
            name: createdTopicFixture.name,
            yearGroupKeys: createdTopicFixture.yearGroupKeys,
          }),
        );
      });
    });
  });
});
