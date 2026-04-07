/**
 * Manage Cohorts Modal — list, create, edit, toggle-active, and delete cohort records.
 *
 * Reads cohorts from the shared React Query cache. Successful mutations invalidate the
 * `cohorts` query key so the list refreshes automatically.
 *
 * Delete-blocked state (IN_USE from the API transport) is surfaced as an inline Alert
 * inside the delete confirmation dialog; the destructive button is disabled so the user
 * cannot retry blindly.
 *
 * Inner form and delete "dialogs" are rendered as inline elements with role="dialog"
 * inside the outer Modal body. This avoids portal async-render issues in jsdom unit
 * tests while maintaining full ARIA semantics and correct Playwright behaviour.
 */

import { Alert, Button, Flex, Form, Input, Modal, Space, Switch, Table, Typography, type TableColumnType } from 'antd';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cohort } from '../../services/referenceData.zod';
import {
  createCohort,
  deleteCohort,
  updateCohort,
} from '../../services/referenceDataService';
import { queryKeys } from '../../query/queryKeys';
import { getCohortsQueryOptions } from '../../query/sharedQueries';
import { ApiTransportError } from '../../errors/apiTransportError';

export type ManageCohortsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

type FormMode = 'create' | 'edit';

type CohortFormValues = Readonly<{
  name: string;
}>;

type DeleteDialogState = Readonly<{
  open: boolean;
  cohort: Cohort | null;
  error: string | null;
  blocked: boolean;
  submitting: boolean;
}>;

const INITIAL_DELETE_STATE: DeleteDialogState = {
  open: false,
  cohort: null,
  error: null,
  blocked: false,
  submitting: false,
};

const FORM_DIALOG_LABEL_ID = 'manage-cohorts-form-dialog-title';
const DELETE_DIALOG_LABEL_ID = 'manage-cohorts-delete-dialog-title';

/**
 * Returns true when the API transport error signals that a record is in use.
 *
 * @param {unknown} error Error caught from a service call.
 * @returns {boolean} True when the error code is IN_USE.
 */
function isInUseError(error: unknown): boolean {
  return error instanceof ApiTransportError && error.code === 'IN_USE';
}

/**
 * Derives a user-facing delete error message from the thrown error.
 *
 * @param {unknown} error Error caught from the delete service call.
 * @param {boolean} blocked Whether the error was an IN_USE block.
 * @returns {string} User-facing error message.
 */
function getDeleteErrorMessage(error: unknown, blocked: boolean): string {
  if (blocked) {
    return 'This cohort is in use by one or more classes and cannot be deleted.';
  }

  return error instanceof Error ? error.message : 'Unable to delete the cohort.';
}

/**
 * Renders an inline dialog section with a labelled title.
 *
 * Uses a native div with role="dialog" so tests can locate it by role and name
 * without relying on portal-based Ant Design Modal rendering in jsdom.
 *
 * @param {Readonly<{
 *   labelId: string;
 *   title: string;
 *   children: React.ReactNode;
 * }>} properties Component properties.
 * @returns {JSX.Element} The rendered inline dialog.
 */
function InlineDialog(properties: Readonly<{
  labelId: string;
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={properties.labelId}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        padding: 24,
        marginTop: 16,
        background: '#fff',
      }}
    >
      <Typography.Title level={5} id={properties.labelId} style={{ marginTop: 0 }}>
        {properties.title}
      </Typography.Title>
      {properties.children}
    </div>
  );
}

type CohortFormSectionProperties = Readonly<{
  editingCohort: Cohort | null;
  form: ReturnType<typeof Form.useForm<CohortFormValues>>[0];
  formDialogTitle: string;
  formError: string | null;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: CohortFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Renders the create/edit form inline dialog.
 *
 * @param {CohortFormSectionProperties} properties Section properties.
 * @returns {JSX.Element} The inline form dialog section.
 */
function CohortFormSection(properties: CohortFormSectionProperties) {
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
      <Form<CohortFormValues>
        key={properties.editingCohort?.key ?? 'create'}
        form={properties.form}
        layout="vertical"
        onFinish={properties.onFinish}
        initialValues={properties.editingCohort === null ? undefined : { name: properties.editingCohort.name }}
      >
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, message: 'Please enter a cohort name.' }]}
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

type CohortDeleteSectionProperties = Readonly<{
  deleteState: DeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}>;

/**
 * Renders the delete confirmation inline dialog.
 *
 * @param {CohortDeleteSectionProperties} properties Section properties.
 * @returns {JSX.Element} The inline delete dialog section.
 */
function CohortDeleteSection(properties: CohortDeleteSectionProperties) {
  const { deleteState, onClose, onConfirm } = properties;

  return (
    <InlineDialog labelId={DELETE_DIALOG_LABEL_ID} title="Delete cohort">
      {deleteState.error === null ? (
        <p>
          Are you sure you want to delete{' '}
          <strong>{deleteState.cohort?.name ?? 'this cohort'}</strong>?
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

type CohortColumnsOptions = Readonly<{
  onEdit: (cohort: Cohort) => void;
  onDelete: (cohort: Cohort) => void;
  onToggleActive: (cohort: Cohort, checked: boolean) => void;
}>;

/**
 * Builds the column definitions for the cohorts management table.
 *
 * @param {CohortColumnsOptions} options Column action callbacks.
 * @returns {TableColumnType<Cohort>[]} Table column definitions.
 */
function buildCohortColumns(options: CohortColumnsOptions): TableColumnType<Cohort>[] {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Start year',
      dataIndex: 'startYear',
      key: 'startYear',
    },
    {
      title: 'Start month',
      dataIndex: 'startMonth',
      key: 'startMonth',
    },
    {
      title: 'Active',
      key: 'active',
      render: (_value: unknown, cohort: Cohort) => (
        <Switch
          checked={cohort.active}
          onChange={(checked) => { options.onToggleActive(cohort, checked); }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_value: unknown, cohort: Cohort) => (
        <Space>
          <Button onClick={() => { options.onEdit(cohort); }}>Edit</Button>
          <Button danger onClick={() => { options.onDelete(cohort); }}>Delete</Button>
        </Space>
      ),
    },
  ];
}

/**
 * Renders the Manage Cohorts modal workflow.
 *
 * @param {ManageCohortsModalProperties} properties Component properties.
 * @returns {JSX.Element} The rendered modal.
 */
export function ManageCohortsModal(properties: ManageCohortsModalProperties) {
  const queryClient = useQueryClient();
  const cohortsQuery = useQuery(getCohortsQueryOptions());
  const cohorts = cohortsQuery.data ?? [];

  const [form] = Form.useForm<CohortFormValues>();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteDialogState>(INITIAL_DELETE_STATE);

  /**
   * Opens the create form with blank fields.
   */
  function openCreateForm(): void {
    form.resetFields();
    setEditingCohort(null);
    setFormError(null);
    setFormMode('create');
  }

  /**
   * Opens the edit form pre-filled with the given cohort.
   *
   * @param {Cohort} cohort Cohort to edit.
   */
  function openEditForm(cohort: Cohort): void {
    setEditingCohort(cohort);
    setFormError(null);
    setFormMode('edit');
  }

  /**
   * Closes the form dialog and resets transient form state.
   */
  function closeFormDialog(): void {
    setFormMode(null);
    setEditingCohort(null);
    setFormError(null);
    form.resetFields();
  }

  /**
   * Invalidates the cohorts query so the list refreshes after a mutation.
   *
   * @returns {Promise<void>} Resolves when the invalidation is queued.
   */
  async function invalidateCohorts(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
  }

  /**
   * Submits the create or edit form and invalidates cohorts on success.
   *
   * @param {CohortFormValues} values Validated form values.
   * @returns {Promise<void>} Resolves when the mutation and invalidation complete.
   */
  async function handleFormFinish(values: CohortFormValues): Promise<void> {
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (formMode === 'create') {
        await createCohort({ record: { name: values.name } });
      } else {
        if (editingCohort === null) {
          throw new Error('editingCohort must be set when formMode is edit');
        }

        await updateCohort({
          key: editingCohort.key,
          record: {
            name: values.name,
            active: editingCohort.active,
            startYear: editingCohort.startYear,
            startMonth: editingCohort.startMonth,
          },
        });
      }

      await invalidateCohorts();
      closeFormDialog();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the cohort.');
    } finally {
      setFormSubmitting(false);
    }
  }

  /**
   * Toggles the active state of a cohort and refreshes the list.
   *
   * Surfaces a visible inline Alert when the mutation fails so the error is never
   * silently swallowed.
   *
   * @param {Cohort} cohort Cohort to update.
   * @param {boolean} checked New active value.
   * @returns {Promise<void>} Resolves when the mutation settles.
   */
  async function handleToggleActive(cohort: Cohort, checked: boolean): Promise<void> {
    setToggleError(null);

    try {
      await updateCohort({
        key: cohort.key,
        record: {
          name: cohort.name,
          active: checked,
          startYear: cohort.startYear,
          startMonth: cohort.startMonth,
        },
      });
      await invalidateCohorts();
    } catch (error: unknown) {
      setToggleError(error instanceof Error ? error.message : 'Unable to update the cohort active state.');
    }
  }

  /**
   * Confirms the delete action, handling blocked and generic failures.
   *
   * @returns {Promise<void>} Resolves when the mutation settles.
   */
  async function handleDeleteConfirm(): Promise<void> {
    if (deleteState.cohort === null) {
      return;
    }

    setDeleteState((previous) => ({ ...previous, submitting: true, error: null }));

    try {
      await deleteCohort({ key: deleteState.cohort.key });
      await invalidateCohorts();
      setDeleteState(INITIAL_DELETE_STATE);
    } catch (error: unknown) {
      const blocked = isInUseError(error);

      setDeleteState((previous) => ({
        ...previous,
        submitting: false,
        error: getDeleteErrorMessage(error, blocked),
        blocked,
      }));
    }
  }

  const formDialogTitle = formMode === 'create' ? 'Create cohort' : 'Edit cohort';
  const isFormDialogOpen = formMode !== null;

  const columns = buildCohortColumns({
    onEdit: openEditForm,
    onDelete: (cohort) => { setDeleteState({ open: true, cohort, error: null, blocked: false, submitting: false }); },
    onToggleActive: (cohort, checked) => { void handleToggleActive(cohort, checked); },
  });

  return (
    <Modal
      open={properties.open}
      title="Manage Cohorts"
      onCancel={properties.onClose}
      footer={
        <Button onClick={properties.onClose}>Cancel</Button>
      }
      width={800}
    >
      <Flex vertical gap={12}>
        <Button type="primary" onClick={openCreateForm}>
          Create cohort
        </Button>
        {toggleError === null ? null : (
          <Alert
            description={toggleError}
            type="error"
            showIcon
          />
        )}
        <Table<Cohort>
          aria-label="cohorts"
          dataSource={cohorts}
          columns={columns}
          rowKey="key"
          pagination={false}
          locale={{ emptyText: 'No cohorts' }}
        />
      </Flex>

      {isFormDialogOpen ? (
        <CohortFormSection
          editingCohort={editingCohort}
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
        <CohortDeleteSection
          deleteState={deleteState}
          onClose={() => { setDeleteState(INITIAL_DELETE_STATE); }}
          onConfirm={() => { void handleDeleteConfirm(); }}
        />
      ) : null}
    </Modal>
  );
}
