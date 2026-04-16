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

import { Alert, Button, Flex, Form, Modal, Skeleton, Space, Switch, Table, type TableColumnType } from 'antd';
import { useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Cohort } from '../../services/referenceData.zod';
import {
  createCohort,
  deleteCohort,
  updateCohort,
} from '../../services/referenceDataService';
import { queryKeys } from '../../query/queryKeys';
import { getCohortsQueryOptions } from '../../query/sharedQueries';
import { isInUseError, getDeleteErrorMessage } from './manageReferenceDataHelpers';
import {
  ReferenceDataDeleteDialog,
  ReferenceDataFormDialog,
  type ReferenceDataFormValues,
} from './manageReferenceDataDialogs';

export type ManageCohortsModalProperties = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

type FormMode = 'create' | 'edit';

type CohortFormValues = ReferenceDataFormValues;

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

type CohortFormDialogProperties = Readonly<{
  editingCohort: Cohort | null;
  form: ReturnType<typeof Form.useForm<CohortFormValues>>[0];
  formDialogTitle: string;
  formError: string | null;
  formMode: FormMode | null;
  formSubmitting: boolean;
  onClose: () => void;
  onFinish: (values: CohortFormValues) => Promise<void>;
  onOk: () => void;
}>;

/**
 * Returns the shared cohort form dialog when the form is open.
 *
 * @param {CohortFormDialogProperties} properties Dialog properties.
 * @returns {JSX.Element | null} Rendered cohort form dialog.
 */
function renderCohortFormDialog(properties: CohortFormDialogProperties) {
  if (properties.formMode === null) {
    return null;
  }

  return (
    <ReferenceDataFormDialog
      formKey={properties.editingCohort?.key ?? 'create'}
      form={properties.form}
      initialName={properties.editingCohort?.name ?? null}
      labelId={FORM_DIALOG_LABEL_ID}
      title={properties.formDialogTitle}
      formError={properties.formError}
      formSubmitting={properties.formSubmitting}
      validationMessage="Please enter a cohort name."
      onClose={properties.onClose}
      onFinish={properties.onFinish}
      onOk={properties.onOk}
    />
  );
}

type CohortDeleteDialogProperties = Readonly<{
  deleteState: DeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}>;

/**
 * Returns the shared cohort delete dialog when delete mode is open.
 *
 * @param {CohortDeleteDialogProperties} properties Dialog properties.
 * @returns {JSX.Element | null} Rendered cohort delete dialog.
 */
function renderCohortDeleteDialog(properties: CohortDeleteDialogProperties) {
  if (!properties.deleteState.open) {
    return null;
  }

  return (
    <ReferenceDataDeleteDialog
      blocked={properties.deleteState.blocked}
      entityLabel="cohort"
      entityName={properties.deleteState.cohort?.name ?? null}
      error={properties.deleteState.error}
      labelId={DELETE_DIALOG_LABEL_ID}
      submitting={properties.deleteState.submitting}
      title="Delete cohort"
      onClose={properties.onClose}
      onConfirm={properties.onConfirm}
    />
  );
}

/**
 * Returns the dialog title for the current cohort form mode.
 *
 * @param {FormMode | null} formMode Current form mode.
 * @returns {string} Form dialog title.
 */
function getCohortFormDialogTitle(formMode: FormMode | null): string {
  return formMode === 'create' ? 'Create cohort' : 'Edit cohort';
}

/**
 * Renders the initial blocking-load treatment for the outer cohorts modal body.
 *
 * @returns {JSX.Element} Loading skeleton content.
 */
function ManageCohortsInitialLoadingState() {
  return (
    <div aria-label="Loading cohorts" role="status">
      <Flex vertical gap={12}>
        <Skeleton.Button active />
        <Skeleton active paragraph={{ rows: 5 }} title={{ width: '24%' }} />
      </Flex>
    </div>
  );
}

type CohortFormFinishHandlerProperties = Readonly<{
  closeFormDialog: () => void;
  editingCohort: Cohort | null;
  formMode: FormMode | null;
  queryClient: QueryClient;
  setFormError: (message: string | null) => void;
  setFormSubmitting: (isSubmitting: boolean) => void;
}>;

/**
 * Builds the cohort form submit handler.
 *
 * @param {CohortFormFinishHandlerProperties} properties Handler dependencies.
 * @returns {(values: CohortFormValues) => Promise<void>} Form submit handler.
 */
function createCohortFormFinishHandler(properties: CohortFormFinishHandlerProperties) {
  return async function handleFormFinish(values: CohortFormValues): Promise<void> {
    properties.setFormSubmitting(true);
    properties.setFormError(null);

    try {
      if (properties.formMode === 'create') {
        await createCohort({ record: { name: values.name } });
      } else {
        if (properties.editingCohort === null) {
          throw new Error('Unable to save the cohort.');
        }

        await updateCohort({
          key: properties.editingCohort.key,
          record: {
            name: values.name,
            active: properties.editingCohort.active,
            startYear: properties.editingCohort.startYear,
            startMonth: properties.editingCohort.startMonth,
          },
        });
      }

      await properties.queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      properties.closeFormDialog();
    } catch (error: unknown) {
      properties.setFormError(error instanceof Error ? error.message : 'Unable to save the cohort.');
    } finally {
      properties.setFormSubmitting(false);
    }
  };
}

type CohortToggleActiveHandlerProperties = Readonly<{
  queryClient: QueryClient;
  setToggleError: (message: string | null) => void;
}>;

/**
 * Builds the cohort active-state toggle handler.
 *
 * @param {CohortToggleActiveHandlerProperties} properties Handler dependencies.
 * @returns {(cohort: Cohort, checked: boolean) => Promise<void>} Toggle handler.
 */
function createCohortToggleActiveHandler(properties: CohortToggleActiveHandlerProperties) {
  return async function handleToggleActive(cohort: Cohort, checked: boolean): Promise<void> {
    properties.setToggleError(null);

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
      await properties.queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
    } catch (error: unknown) {
      properties.setToggleError(error instanceof Error ? error.message : 'Unable to update the cohort active state.');
    }
  };
}

type CohortDeleteConfirmHandlerProperties = Readonly<{
  deleteState: DeleteDialogState;
  queryClient: QueryClient;
  setDeleteState: (updater: (previous: DeleteDialogState) => DeleteDialogState) => void;
}>;

/**
 * Builds the cohort delete confirmation handler.
 *
 * @param {CohortDeleteConfirmHandlerProperties} properties Handler dependencies.
 * @returns {() => Promise<void>} Delete confirmation handler.
 */
function createCohortDeleteConfirmHandler(properties: CohortDeleteConfirmHandlerProperties) {
  return async function handleDeleteConfirm(): Promise<void> {
    if (properties.deleteState.cohort === null) {
      return;
    }

    properties.setDeleteState((previous) => ({ ...previous, submitting: true, error: null }));

    try {
      await deleteCohort({ key: properties.deleteState.cohort.key });
      await properties.queryClient.invalidateQueries({ queryKey: queryKeys.cohorts() });
      properties.setDeleteState(() => INITIAL_DELETE_STATE);
    } catch (error: unknown) {
      const blocked = isInUseError(error);

      properties.setDeleteState((previous) => ({
        ...previous,
        submitting: false,
        error: getDeleteErrorMessage(error, blocked, 'cohort'),
        blocked,
      }));
    }
  };
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
  const isInitialLoading = cohortsQuery.isPending && cohortsQuery.data === undefined;

  const [form] = Form.useForm<CohortFormValues>();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteDialogState>(INITIAL_DELETE_STATE);
  const handleFormFinish = createCohortFormFinishHandler({
    closeFormDialog,
    editingCohort,
    formMode,
    queryClient,
    setFormError,
    setFormSubmitting,
  });
  const handleToggleActive = createCohortToggleActiveHandler({
    queryClient,
    setToggleError,
  });
  const handleDeleteConfirm = createCohortDeleteConfirmHandler({
    deleteState,
    queryClient,
    setDeleteState,
  });

  /**
   * Opens the create form with blank fields.
   */
  function openCreateForm(): void {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
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
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    setEditingCohort(cohort);
    setFormError(null);
    setFormMode('edit');
  }

  /**
   * Closes the form dialog and resets transient form state.
   */
  function closeFormDialog(): void {
    const wasFormOpen = formMode !== null;

    setFormMode(null);
    setEditingCohort(null);
    setFormError(null);
    setFormSubmitting(false);

    if (wasFormOpen) {
      form.resetFields();
    }
  }

  /**
   * Closes the outer modal and clears transient child-dialog state.
   *
   * @returns {void} No return value.
   */
  function handleModalClose(): void {
    closeFormDialog();
    setDeleteState(INITIAL_DELETE_STATE);
    setToggleError(null);
    properties.onClose();
  }

  /**
   * Opens the delete confirmation for the given cohort.
   *
   * @param {Cohort} cohort Cohort to delete.
   */
  function openDeleteDialog(cohort: Cohort): void {
    closeFormDialog();
    setDeleteState({
      open: true,
      cohort,
      error: null,
      blocked: false,
      submitting: false,
    });
  }

  const columns = buildCohortColumns({
    onEdit: openEditForm,
    onDelete: openDeleteDialog,
    onToggleActive: (cohort, checked) => { void handleToggleActive(cohort, checked); },
  });

  return (
    <Modal
      open={properties.open}
      title="Manage Cohorts"
      onCancel={handleModalClose}
      footer={
        <Button onClick={handleModalClose}>Cancel</Button>
      }
      width={800}
    >
      {isInitialLoading ? (
        <ManageCohortsInitialLoadingState />
      ) : (
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
      )}

      {renderCohortFormDialog({
        editingCohort,
        form,
        formDialogTitle: getCohortFormDialogTitle(formMode),
        formError,
        formMode,
        formSubmitting,
        onClose: closeFormDialog,
        onFinish: handleFormFinish,
        onOk: () => { form.submit(); },
      })}

      {renderCohortDeleteDialog({
        deleteState,
        onClose: () => { setDeleteState(INITIAL_DELETE_STATE); },
        onConfirm: () => { void handleDeleteConfirm(); },
      })}
    </Modal>
  );
}
