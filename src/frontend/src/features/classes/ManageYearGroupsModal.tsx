/**
 * Manage Year Groups Modal — list, create, edit, and delete year-group records.
 *
 * Reads year groups from the shared React Query cache. Successful mutations invalidate
 * the `yearGroups` query key so the list refreshes automatically.
 *
 * Delete-blocked state (IN_USE from the API transport) is surfaced as an inline Alert
 * inside the delete confirmation dialog; the destructive button is disabled so the user
 * cannot retry blindly.
 *
 * Inner form and delete "dialogs" are rendered as inline elements with role="dialog"
 * inside the outer Modal body. This avoids portal async-render issues in jsdom unit
 * tests while maintaining full ARIA semantics and correct Playwright behaviour.
 */

import { Alert, Button, Flex, Form, Input, Modal, Space, Table, type TableColumnType } from 'antd';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { YearGroup } from '../../services/referenceData.zod';
import {
  createYearGroup,
  deleteYearGroup,
  updateYearGroup,
} from '../../services/referenceDataService';
import { queryKeys } from '../../query/queryKeys';
import { getYearGroupsQueryOptions } from '../../query/sharedQueries';
import { InlineDialog } from './InlineDialog';
import { isInUseError, getDeleteErrorMessage } from './manageReferenceDataHelpers';

export type ManageYearGroupsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

type FormMode = 'create' | 'edit';

type YearGroupFormValues = Readonly<{
  name: string;
}>;

type DeleteDialogState = Readonly<{
  open: boolean;
  yearGroup: YearGroup | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

const INITIAL_DELETE_STATE: DeleteDialogState = {
  open: false,
  yearGroup: null,
  error: null,
  blocked: false,
  submitting: false,
};

const FORM_DIALOG_LABEL_ID = 'manage-year-groups-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-year-groups-delete-dialog-title';

type YearGroupFormSectionProperties = Readonly<{
  editingYearGroup: YearGroup | null;
  form: ReturnType<typeof Form.useForm<YearGroupFormValues>>[0];
  formDialogTitle: string;
  formError: string | null;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: YearGroupFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Renders the create/edit form inline dialog.
 *
 * @param {YearGroupFormSectionProperties} properties Section properties.
 * @returns {JSX.Element} The inline form dialog section.
 */
function YearGroupFormSection(properties: YearGroupFormSectionProperties) {
  return (
    <InlineDialog labelId={FORM_DIALOG_LABEL_ID} title={properties.formDialogTitle}>
      {properties.formError === null ? null : (
        <Alert
          description={properties.formError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form<YearGroupFormValues>
        key={properties.editingYearGroup?.key ?? 'create'}
        form={properties.form}
        layout="vertical"
        onFinish={properties.onFinish}
        initialValues={properties.editingYearGroup === null ? undefined : { name: properties.editingYearGroup.name }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please enter a year group name.' }]}
        >
          <Input disabled={properties.formSubmitting} />
        </Form.Item>
      </Form>
      <Space style={{ marginTop: 16 }}>
        <Button onClick={properties.onClose}>Cancel</Button>
        <Button type="primary" loading={properties.formSubmitting} onClick={properties.onOk}>
          OK
        </Button>
      </Space>
    </InlineDialog>
  );
}

type YearGroupDeleteSectionProperties = Readonly<{
  deleteState: DeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}>;

/**
 * Renders the delete confirmation inline dialog.
 *
 * @param {YearGroupDeleteSectionProperties} properties Section properties.
 * @returns {JSX.Element} The inline delete dialog section.
 */
function YearGroupDeleteSection(properties: YearGroupDeleteSectionProperties) {
  const { deleteState, onClose, onConfirm } = properties;

  return (
    <InlineDialog labelId={DELETE_DIALOG_LABEL_ID} title="Delete year group">
      {deleteState.error === null ? (
        <p>
          Are you sure you want to delete{' '}
          <strong>{deleteState.yearGroup?.name ?? 'this year group'}</strong>?
        </p>
      ) : (
        <Alert
          description={deleteState.error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Space style={{ marginTop: 16 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          danger
          disabled={deleteState.blocked || deleteState.submitting}
          loading={deleteState.submitting}
          onClick={onConfirm}
        >
          Delete
        </Button>
      </Space>
    </InlineDialog>
  );
}

type YearGroupColumnsOptions = Readonly<{
  onEdit: (yearGroup: YearGroup) => void;
  onDelete: (yearGroup: YearGroup) => void;
}>;

/**
 * Builds the column definitions for the year groups management table.
 *
 * @param {YearGroupColumnsOptions} options Column action callbacks.
 * @returns {TableColumnType<YearGroup>[]} Table column definitions.
 */
function buildYearGroupColumns(options: YearGroupColumnsOptions): TableColumnType<YearGroup>[] {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value: unknown, yearGroup: YearGroup) => (
        <Space>
          <Button onClick={() => { options.onEdit(yearGroup); }}>Edit</Button>
          <Button danger onClick={() => { options.onDelete(yearGroup); }}>Delete</Button>
        </Space>
      ),
    },
  ];
}

/**
 * Renders the Manage Year Groups modal workflow.
 *
 * @param {ManageYearGroupsModalProperties} properties Component properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function ManageYearGroupsModal(properties: ManageYearGroupsModalProperties) {
  const queryClient = useQueryClient();
  const yearGroupsQuery = useQuery(getYearGroupsQueryOptions());
  const yearGroups = yearGroupsQuery.data ?? [];

  const [form] = Form.useForm<YearGroupFormValues>();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingYearGroup, setEditingYearGroup] = useState<YearGroup | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteDialogState>(INITIAL_DELETE_STATE);

  /**
   * Opens the create form with blank fields.
   */
  function openCreateForm(): void {
    form.resetFields();
    setEditingYearGroup(null);
    setFormError(null);
    setFormMode('create');
  }

  /**
   * Opens the edit form pre-filled with the given year group.
   *
   * @param {YearGroup} yearGroup Year group to edit.
   */
  function openEditForm(yearGroup: YearGroup): void {
    setEditingYearGroup(yearGroup);
    setFormError(null);
    setFormMode('edit');
  }

  /**
   * Closes the form dialog and resets transient form state.
   */
  function closeFormDialog(): void {
    setFormMode(null);
    setEditingYearGroup(null);
    setFormError(null);
    form.resetFields();
  }

  /**
   * Submits the create or edit form and invalidates yearGroups on success.
   *
   * @param {YearGroupFormValues} values Validated form values.
   * @returns {Promise<void>} Resolves when the mutation and invalidation complete.
   */
  async function handleFormFinish(values: YearGroupFormValues): Promise<void> {
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (formMode === 'create') {
        await createYearGroup({ record: { name: values.name } });
      } else {
        if (editingYearGroup === null) {
          throw new Error('editingYearGroup must be set when formMode is edit');
        }

        await updateYearGroup({
          key: editingYearGroup.key,
          record: { name: values.name },
        });
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
      closeFormDialog();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the year group.');
    } finally {
      setFormSubmitting(false);
    }
  }

  /**
   * Confirms the delete action, handling blocked and generic failures.
   *
   * @returns {Promise<void>} Resolves when the mutation settles.
   */
  async function handleDeleteConfirm(): Promise<void> {
    if (deleteState.yearGroup === null) {
      return;
    }

    setDeleteState((previous) => ({ ...previous, submitting: true, error: null }));

    try {
      await deleteYearGroup({ key: deleteState.yearGroup.key });
      await queryClient.invalidateQueries({ queryKey: queryKeys.yearGroups() });
      setDeleteState(INITIAL_DELETE_STATE);
    } catch (error: unknown) {
      const blocked = isInUseError(error);

      setDeleteState((previous) => ({
        ...previous,
        submitting: false,
        error: getDeleteErrorMessage(error, blocked, 'year group'),
        blocked,
      }));
    }
  }

  const formDialogTitle = formMode === 'create' ? 'Create year group' : 'Edit year group';
  const isFormDialogOpen = formMode !== null;

  const columns = buildYearGroupColumns({
    onEdit: openEditForm,
    onDelete: (yearGroup) => { setDeleteState({ open: true, yearGroup, error: null, blocked: false, submitting: false }); },
  });

  return (
    <Modal
      open={properties.open}
      title="Manage Year Groups"
      onCancel={properties.onClose}
      footer={
        <Button onClick={properties.onClose}>Cancel</Button>
      }
      width={700}
    >
      <Flex vertical gap={12}>
        <Button type="primary" onClick={openCreateForm}>
          Create year group
        </Button>
        <Table<YearGroup>
          aria-label="year groups"
          dataSource={yearGroups}
          columns={columns}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: 'No year groups' }}
        />
      </Flex>

      {isFormDialogOpen ? (
        <YearGroupFormSection
          editingYearGroup={editingYearGroup}
          form={form}
          formDialogTitle={formDialogTitle}
          formError={formError}
          formSubmitting={formSubmitting}
          onClose={closeFormDialog}
          onFinish={handleFormFinish}
          onOk={() => { form.submit(); }}
        />
      ) : null}

      {deleteState.open ? (
        <YearGroupDeleteSection
          deleteState={deleteState}
          onClose={() => { setDeleteState(INITIAL_DELETE_STATE); }}
          onConfirm={() => { void handleDeleteConfirm(); }}
        />
      ) : null}
    </Modal>
  );
}
